"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ENGINE_VERSION } from "@/lib/compare/engine";
import { loadCompareProperties } from "@/lib/compare/load";
import { loadSavedState } from "@/lib/compare/saved";
import { SCORE_VERSION } from "@/lib/compare/score";
import { buildSnapshot } from "@/lib/compare/snapshot";
import { compareStateSchema, type CompareState } from "@/lib/compare/state";
import { FLAGS } from "@/lib/flags";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { hashShareToken } from "@/lib/vision/share";

// Owner-only RLS on every comparison table; these actions validate input.

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function saveComparison(setId: string | null, input: CompareState): Promise<Result> {
  if (!FLAGS.compare) return { ok: false, error: "Compare isn't available." };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "Sign in to save comparisons." };
  const parsed = compareStateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your inputs." };
  if (setId && !z.string().uuid().safeParse(setId).success) return { ok: false, error: "Unknown comparison." };
  const s = parsed.data;
  const supabase = await createClient();

  let id = setId;
  if (id) {
    const { data } = await supabase.from("comparison_sets").update({ name: s.name, mode: s.mode }).eq("id", id).select("id").maybeSingle();
    if (!data) return { ok: false, error: "Unknown comparison." };
    await supabase.from("comparison_items").delete().eq("comparison_set_id", id);
  } else {
    const { data, error } = await supabase.from("comparison_sets").insert({ owner_user_id: ctx.user.id, name: s.name, mode: s.mode }).select("id").single();
    if (error || !data) return { ok: false, error: error?.code === "54000" ? "You've reached 100 saved comparisons." : "We couldn't save that." };
    id = data.id;
  }
  const { error: itemsError } = await supabase.from("comparison_items").insert(
    s.listingIds.map((listingId, i) => ({ comparison_set_id: id!, listing_id: listingId, sort_order: i, overrides_json: s.overrides[listingId] ?? {} })),
  );
  const { error: assumptionsError } = await supabase.from("comparison_assumptions").upsert({
    comparison_set_id: id,
    assumptions_json: s.assumptions,
    weights_json: s.weights,
    engine_version: ENGINE_VERSION,
    score_version: SCORE_VERSION,
  });
  if (itemsError || assumptionsError) return { ok: false, error: "We couldn't save every part of that comparison. Please try again." };
  revalidatePath(`/compare/${id}`);
  return { ok: true, id: id! };
}

export async function deleteComparison(setId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx || !z.string().uuid().safeParse(setId).success) return { ok: false, error: "Unknown comparison." };
  const supabase = await createClient();
  const { data } = await supabase.from("comparison_sets").delete().eq("id", setId).select("id").maybeSingle();
  return data ? { ok: true, id: setId } : { ok: false, error: "Unknown comparison." };
}

/** Freezes a redacted snapshot and returns a secret link token (only its hash is stored). */
export async function shareComparison(setId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx || !z.string().uuid().safeParse(setId).success) return { ok: false, error: "Unknown comparison." };
  const supabase = await createClient();
  const state = await loadSavedState(setId);
  if (!state) return { ok: false, error: "Unknown comparison." };
  const snapshot = buildSnapshot(await loadCompareProperties(supabase, state.listingIds), state);
  const token = randomBytes(24).toString("base64url");
  const { data } = await supabase
    .from("comparison_sets")
    .update({ share_token_hash: hashShareToken(token), share_snapshot: snapshot })
    .eq("id", setId)
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, error: "Unknown comparison." };
  revalidatePath(`/compare/${setId}`);
  return { ok: true, token };
}

export async function unshareComparison(setId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx || !z.string().uuid().safeParse(setId).success) return { ok: false, error: "Unknown comparison." };
  const supabase = await createClient();
  await supabase.from("comparison_sets").update({ share_token_hash: null, share_snapshot: null }).eq("id", setId);
  revalidatePath(`/compare/${setId}`);
  return { ok: true, id: setId };
}
