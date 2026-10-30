"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { timeZoneFor, type State } from "@/lib/jurisdictions";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { evidenceSchema, formDataToObject, propertySchema, type FormState } from "@/lib/validation";

// Authorisation is enforced by RLS; these actions only validate input and choose the
// organisation from the server-side session (never from the form).

export async function createProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireOrg("investor");
  const parsed = propertySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_org_id: ctx.active.organisation.id,
      address: parsed.data.address,
      suburb: parsed.data.suburb,
      postcode: parsed.data.postcode,
      jurisdiction: parsed.data.state,
      lot_dp: parsed.data.lotDp,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "We couldn't save the property. Please try again." };

  revalidatePath("/investor");
  redirect(`/investor/properties/${data.id}`);
}

const uuid = z.string().uuid();

export async function addEvidence(propertyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOrg("investor");
  if (!uuid.safeParse(propertyId).success) return { error: "Unknown property." };

  const supabase = await createClient();
  // "Today" is checked in the property's own time zone (e.g. Perth vs Sydney).
  const { data: property } = await supabase.from("properties").select("jurisdiction, postcode").eq("id", propertyId).maybeSingle();
  if (!property) return { error: "Unknown property." };
  const parsed = evidenceSchema(new Date(), timeZoneFor(property.jurisdiction as State, property.postcode)).safeParse(
    formDataToObject(formData),
  );
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const { error } = await supabase.from("evidence").insert({
    property_id: propertyId,
    title: parsed.data.title,
    source_type: parsed.data.sourceType,
    source_url: parsed.data.sourceUrl,
    fetched_at: parsed.data.fetchedAt,
    notes: parsed.data.notes,
  });
  if (error) return { error: "We couldn't save that evidence. Please try again." };

  revalidatePath(`/investor/properties/${propertyId}`);
  return { message: "Evidence added. It stays “Unverified” until you check it against the source." };
}

const statusSchema = z.object({
  evidenceId: uuid,
  propertyId: uuid,
  status: z.enum(["unverified", "verified", "disputed", "superseded"]),
});

export async function setEvidenceStatus(formData: FormData) {
  await requireOrg("investor");
  const parsed = statusSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  // verified_by / verified_at are stamped by a database trigger.
  await supabase
    .from("evidence")
    .update({ verification_status: parsed.data.status })
    .eq("id", parsed.data.evidenceId)
    .eq("property_id", parsed.data.propertyId);
  revalidatePath(`/investor/properties/${parsed.data.propertyId}`);
}
