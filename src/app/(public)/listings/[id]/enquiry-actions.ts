"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation";

const uuid = z.string().uuid();

/**
 * Buyer registers interest in an off-market home whose verified owner has opted in. The message
 * goes through SitePilot; no contact details are exchanged. RLS and triggers enforce opt-in,
 * verification, no self-enquiries and a 5-per-day limit.
 */
export async function sendEnquiry(listingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getSessionContext();
  if (!ctx) return { error: "Sign in to register interest." };
  if (!uuid.safeParse(listingId).success) return { error: "Unknown listing." };
  const message = z
    .string()
    .trim()
    .min(10, "Write at least 10 characters")
    .max(1000)
    .refine((m) => !/(\+?\d[\d\s-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)/.test(m), "Please don't include phone numbers or email addresses")
    .safeParse(formData.get("message"));
  if (!message.success) return { fieldErrors: { message: message.error.issues.map((i) => i.message) } };

  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("property_record_id").eq("id", listingId).maybeSingle();
  if (!listing?.property_record_id) return { error: "This property isn't accepting enquiries." };
  const { data: target } = await supabase.rpc("enquiry_target_for_record", { record: listing.property_record_id });
  if (!target) return { error: "This property isn't accepting enquiries." };

  const { error } = await supabase.from("buyer_enquiries").insert({ owned_property_id: target, buyer_id: ctx.user.id, message: message.data });
  if (error) {
    return { error: error.code === "54000" ? "You've reached today's enquiry limit. Try again tomorrow." : "We couldn't send that. Please try again." };
  }
  revalidatePath(`/listings/${listingId}`);
  return { message: "Sent. The owner will see your message in SitePilot. Your contact details aren't shared." };
}

export async function withdrawEnquiry(formData: FormData) {
  const ctx = await getSessionContext();
  const p = z.object({ enquiryId: uuid, listingId: uuid }).safeParse({ enquiryId: formData.get("enquiryId"), listingId: formData.get("listingId") });
  if (!ctx || !p.success) return;
  const supabase = await createClient();
  await supabase.from("buyer_enquiries").update({ status: "withdrawn" }).eq("id", p.data.enquiryId);
  revalidatePath(`/listings/${p.data.listingId}`);
}
