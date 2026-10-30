"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrg } from "@/lib/session";
import { evidenceStore } from "@/lib/storage/object-store";
import { checkEvidence, safeFileName } from "@/lib/storage/file-check";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, propertySchema, type FormState } from "@/lib/validation";

// Authorisation is enforced by RLS on every table; these actions validate input only.

const uuid = z.string().uuid();
const pathFor = (id: string) => `/my-property/${id}`;

const homeSchema = propertySchema.and(
  z.object({
    nickname: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((v) => (v ? v : null)),
    recordId: z
      .string()
      .optional()
      .transform((v) => (v && uuid.safeParse(v).success ? v : null)),
  }),
);

export async function addHome(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  const parsed = homeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("owned_properties")
    .insert({
      user_id: ctx.user.id,
      property_record_id: d.recordId,
      nickname: d.nickname,
      address: d.address,
      suburb: d.suburb,
      state: d.state,
      postcode: d.postcode,
    })
    .select("id")
    .single();
  if (error?.code === "23505" && d.recordId) {
    const { data: existing } = await supabase.from("owned_properties").select("id").eq("property_record_id", d.recordId).maybeSingle();
    if (existing) redirect(pathFor(existing.id));
  }
  if (error || !data) return { error: "We couldn't add that property. Please try again." };
  redirect(pathFor(data.id));
}

export async function addNote(ownedId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOrg();
  const body = z.string().trim().min(1, "Write a note first").max(4000).safeParse(formData.get("body"));
  if (!uuid.safeParse(ownedId).success) return { error: "Unknown property." };
  if (!body.success) return { fieldErrors: { body: body.error.issues.map((i) => i.message) } };
  const supabase = await createClient();
  const { error } = await supabase.from("property_notes").insert({ owned_property_id: ownedId, body: body.data });
  if (error) return { error: "We couldn't save that note." };
  revalidatePath(pathFor(ownedId));
  return { message: "Note saved." };
}

export async function addMaintenance(ownedId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOrg();
  const parsed = z
    .object({
      title: z.string().trim().min(1, "What needs doing?").max(200),
      dueOn: z
        .string()
        .optional()
        .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
    })
    .safeParse(formDataToObject(formData));
  if (!uuid.safeParse(ownedId).success) return { error: "Unknown property." };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_items")
    .insert({ owned_property_id: ownedId, title: parsed.data.title, due_on: parsed.data.dueOn });
  if (error) return { error: "We couldn't add that task." };
  revalidatePath(pathFor(ownedId));
  return { message: "Added to your checklist." };
}

const itemForm = z.object({ ownedId: uuid, itemId: uuid });

export async function toggleMaintenance(formData: FormData) {
  await requireOrg();
  const p = itemForm.extend({ done: z.enum(["true", "false"]) }).safeParse(formDataToObject(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase
    .from("maintenance_items")
    .update({ done_at: p.data.done === "true" ? new Date().toISOString() : null })
    .eq("id", p.data.itemId);
  revalidatePath(pathFor(p.data.ownedId));
}

export async function deleteNote(formData: FormData) {
  await requireOrg();
  const p = itemForm.safeParse(formDataToObject(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from("property_notes").delete().eq("id", p.data.itemId);
  revalidatePath(pathFor(p.data.ownedId));
}

export async function setEnquiries(formData: FormData) {
  await requireOrg();
  const p = z.object({ ownedId: uuid, on: z.enum(["true", "false"]) }).safeParse(formDataToObject(formData));
  if (!p.success) return;
  const supabase = await createClient();
  // Turning enquiries off also closes open enquiries (database trigger).
  await supabase.from("owned_properties").update({ accepts_enquiries: p.data.on === "true" }).eq("id", p.data.ownedId);
  revalidatePath(pathFor(p.data.ownedId));
}

export async function removeHome(formData: FormData) {
  await requireOrg();
  const id = uuid.safeParse(formData.get("ownedId"));
  if (!id.success) return;
  const supabase = await createClient();
  // Delete any evidence files this user uploaded for the property first.
  const { data: claims } = await supabase.from("homeowner_claims").select("evidence_key").eq("owned_property_id", id.data);
  const store = evidenceStore(supabase);
  for (const c of claims ?? []) if (c.evidence_key) await store.remove(c.evidence_key);
  await supabase.from("owned_properties").delete().eq("id", id.data);
  redirect("/my-property");
}

// ─── Claims ─────────────────────────────────────────────────────────────────

export async function submitClaim(ownedId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  if (!uuid.safeParse(ownedId).success) return { error: "Unknown property." };
  if (formData.get("declaration") !== "yes") {
    return { fieldErrors: { declaration: ["Please confirm the declaration."] } };
  }
  const file = formData.get("evidence");
  if (!(file instanceof File)) return { fieldErrors: { evidence: ["Choose a file to upload."] } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkEvidence(bytes);
  if (!check.ok) return { fieldErrors: { evidence: [check.error] } };

  const supabase = await createClient();
  const { data: owned } = await supabase.from("owned_properties").select("id").eq("id", ownedId).maybeSingle();
  if (!owned) return { error: "Unknown property." };

  const key = `${ctx.user.id}/${randomUUID()}.${check.type.ext}`;
  const store = evidenceStore(supabase);
  try {
    await store.put(key, bytes, check.type.mime);
  } catch {
    return { error: "We couldn't upload that file. Please try again." };
  }
  const { error } = await supabase.from("homeowner_claims").insert({
    owned_property_id: ownedId,
    claimant_id: ctx.user.id,
    evidence_key: key,
    evidence_name: safeFileName(file.name),
    evidence_mime: check.type.mime,
  });
  if (error) {
    await store.remove(key);
    return {
      error: error.code === "23505" ? "You already have an open claim for this property." : "We couldn't submit your claim. Please try again.",
    };
  }
  revalidatePath(pathFor(ownedId));
  redirect(`${pathFor(ownedId)}?claim=submitted`);
}

export async function withdrawClaim(formData: FormData) {
  await requireOrg();
  const p = z.object({ ownedId: uuid, claimId: uuid }).safeParse(formDataToObject(formData));
  if (!p.success) return;
  const supabase = await createClient();
  const { data: claim } = await supabase.from("homeowner_claims").select("evidence_key").eq("id", p.data.claimId).maybeSingle();
  const { error } = await supabase.from("homeowner_claims").update({ status: "withdrawn" }).eq("id", p.data.claimId);
  if (!error && claim?.evidence_key) await evidenceStore(supabase).remove(claim.evidence_key);
  revalidatePath(pathFor(p.data.ownedId));
}

// ─── Enquiries (owner side) ─────────────────────────────────────────────────

export async function respondToEnquiry(formData: FormData) {
  await requireOrg();
  const p = z
    .object({
      ownedId: uuid,
      enquiryId: uuid,
      action: z.enum(["reply", "decline", "close"]),
      reply: z.string().trim().max(1000).optional(),
    })
    .safeParse(formDataToObject(formData));
  if (!p.success) return;
  const supabase = await createClient();
  const update =
    p.data.action === "reply" && p.data.reply
      ? { status: "replied" as const, owner_reply: p.data.reply }
      : { status: p.data.action === "decline" ? ("declined" as const) : ("closed" as const) };
  await supabase.from("buyer_enquiries").update(update).eq("id", p.data.enquiryId);
  revalidatePath(pathFor(p.data.ownedId));
}
