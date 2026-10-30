"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LISTING_COLUMNS, type Listing } from "@/lib/discovery/types";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const decisionInput = z.object({
  listingId: uuid,
  action: z.enum(["save", "pass", "undo", "unsave"]),
  source: z.enum(["swipe", "button", "keyboard", "list"]),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Record a signed-in user's decision. RLS stamps and scopes rows to the caller; guests keep
 * decisions in their browser instead (see guest-store.ts).
 */
export async function recordDecision(input: z.input<typeof decisionInput>): Promise<ActionResult> {
  const parsed = decisionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "Sign in to save across devices." };

  const { listingId, action, source } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("swipe_events").insert({ listing_id: listingId, action, source, user_id: ctx.user.id });
  if (error) {
    return { ok: false, error: error.code === "54000" ? "You're going a bit fast. Try again shortly." : "We couldn't save that. Please try again." };
  }

  if (action === "save") {
    const { error: saveError } = await supabase
      .from("saved_properties")
      .upsert({ listing_id: listingId, user_id: ctx.user.id }, { onConflict: "user_id,listing_id", ignoreDuplicates: true });
    if (saveError) return { ok: false, error: "We couldn't save that. Please try again." };
  } else if (action === "undo" || action === "unsave") {
    await supabase.from("saved_properties").delete().eq("listing_id", listingId);
  }
  revalidatePath("/saved");
  return { ok: true };
}

/** Bring a guest's on-device saves into their account after they sign in. */
export async function importGuestSaves(listingIds: string[]): Promise<ActionResult & { imported?: number }> {
  const ids = z.array(uuid).max(200).safeParse(listingIds);
  if (!ids.success) return { ok: false, error: "Invalid request." };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "Sign in first." };
  if (ids.data.length === 0) return { ok: true, imported: 0 };

  const supabase = await createClient();
  // Only listings the user can actually see (demo listings today) are imported.
  const { data: visible } = await supabase.from("listings").select("id").in("id", ids.data);
  const valid = (visible ?? []).map((r) => r.id);
  if (valid.length === 0) return { ok: true, imported: 0 };

  const { error } = await supabase
    .from("saved_properties")
    .upsert(valid.map((id) => ({ listing_id: id, user_id: ctx.user.id })), { onConflict: "user_id,listing_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: "We couldn't import your saves. Please try again." };
  await supabase.from("swipe_events").insert(valid.map((id) => ({ listing_id: id, action: "save" as const, source: "import" as const, user_id: ctx.user.id })));
  revalidatePath("/saved");
  return { ok: true, imported: valid.length };
}

/** Public: listing cards for a guest's saved ids (demo listings only, via RLS). */
export async function getListings(listingIds: string[]): Promise<Listing[]> {
  const ids = z.array(uuid).max(200).safeParse(listingIds);
  if (!ids.success || ids.data.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(LISTING_COLUMNS).in("id", ids.data);
  return data ?? [];
}
