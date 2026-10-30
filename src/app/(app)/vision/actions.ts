"use server";

import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FLAGS } from "@/lib/flags";
import { requireOrg } from "@/lib/session";
import { objectStore } from "@/lib/storage/object-store";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation";
import { prepareSource, watermark } from "@/lib/vision/image";
import { isPreset, STYLES, type VisionMode } from "@/lib/vision/presets";
import { visionProvider } from "@/lib/vision/provider";
import { hashShareToken } from "@/lib/vision/share";

// Authorisation is enforced by RLS (owner-only tables and storage); these actions validate input.

const uuid = z.string().uuid();
const MODE_IDS = ["birds_eye", "exterior", "interior"] as const;
const pathFor = (id: string) => `/vision/${id}`;

const projectSchema = z.object({
  title: z.string().trim().min(1, "Give it a name").max(80),
  mode: z.enum(MODE_IDS, { message: "Choose what the photo shows" }),
  homeId: z
    .string()
    .optional()
    .transform((v) => (v && uuid.safeParse(v).success ? v : null)),
});

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!FLAGS.vision) return { error: "SitePilot Vision isn't available." };
  const ctx = await requireOrg();
  const parsed = projectSchema.safeParse({ title: formData.get("title"), mode: formData.get("mode"), homeId: formData.get("homeId") ?? undefined });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  if (formData.get("rights") !== "yes") return { fieldErrors: { rights: ["Please confirm you can use this photo."] } };
  const file = formData.get("photo");
  if (!(file instanceof File)) return { fieldErrors: { photo: ["Choose a photo to upload."] } };
  const prepared = await prepareSource(new Uint8Array(await file.arrayBuffer()));
  if (!prepared.ok) return { fieldErrors: { photo: [prepared.error] } };

  const supabase = await createClient();
  const key = `${ctx.user.id}/${randomUUID()}/source.jpg`;
  const store = objectStore(supabase, "vision-sources");
  try {
    await store.put(key, prepared.image.bytes, "image/jpeg");
  } catch {
    return { error: "We couldn't upload that photo. Please try again." };
  }
  const { data, error } = await supabase
    .from("visual_projects")
    .insert({
      user_id: ctx.user.id,
      owned_property_id: parsed.data.homeId,
      title: parsed.data.title,
      mode: parsed.data.mode,
      source_key: key,
      source_width: prepared.image.width,
      source_height: prepared.image.height,
    })
    .select("id")
    .single();
  if (error || !data) {
    await store.remove(key);
    return { error: error?.code === "54000" ? "You've reached the 50-project limit. Delete an old project first." : "We couldn't create that project." };
  }
  redirect(pathFor(data.id));
}

const generateSchema = z.object({
  preset: z.string().regex(/^[a-z_]{1,40}$/, "Choose an idea"),
  style: z.enum(STYLES.map((s) => s.id) as [string, ...string[]], { message: "Choose a style" }),
  prompt: z
    .string()
    .trim()
    .max(300, "Keep it under 300 characters")
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function generateConcept(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!FLAGS.vision) return { error: "SitePilot Vision isn't available." };
  const ctx = await requireOrg();
  if (!uuid.safeParse(projectId).success) return { error: "Unknown project." };
  const parsed = generateSchema.safeParse({ preset: formData.get("preset"), style: formData.get("style"), prompt: formData.get("prompt") ?? undefined });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data: project } = await supabase.from("visual_projects").select("id, mode, source_key").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Unknown project." };
  const mode = project.mode as VisionMode;
  if (!isPreset(mode, parsed.data.preset)) return { fieldErrors: { preset: ["Choose an idea for this kind of photo"] } };

  // Reserve the credit before calling the provider, so cost limits hold even if the call fails.
  const { error: quota } = await supabase.rpc("reserve_vision_credit");
  if (quota) return { error: quota.code === "54000" ? "You've used today's 10 concepts. Try again tomorrow." : "We couldn't start that. Please try again." };

  const source = await objectStore(supabase, "vision-sources").get(project.source_key);
  if (!source) return { error: "We couldn't load your photo. Please try again." };
  let output: Buffer;
  let meta: { provider: string; model: string; costCents: number };
  try {
    const res = await visionProvider().generate({ image: Buffer.from(source), mode, preset: parsed.data.preset, style: parsed.data.style as never, prompt: parsed.data.prompt });
    output = await watermark(res.image);
    meta = res;
  } catch {
    return { error: "The concept couldn't be generated. Please try again." };
  }

  const key = `${ctx.user.id}/${path.posix.basename(path.posix.dirname(project.source_key))}/${randomUUID()}.jpg`;
  const outputs = objectStore(supabase, "vision-outputs");
  try {
    await outputs.put(key, output, "image/jpeg");
  } catch {
    return { error: "We couldn't save the concept. Please try again." };
  }
  const { data: version, error } = await supabase
    .from("visual_versions")
    .insert({
      project_id: project.id,
      user_id: ctx.user.id,
      preset: parsed.data.preset,
      style: parsed.data.style,
      prompt: parsed.data.prompt,
      provider: meta.provider,
      model: meta.model,
      cost_cents: meta.costCents,
      output_key: key,
    })
    .select("id")
    .single();
  if (error || !version) {
    await outputs.remove(key);
    return { error: "We couldn't save the concept. Please try again." };
  }
  redirect(`${pathFor(project.id)}?v=${version.id}`);
}

const versionRef = z.object({ projectId: uuid, versionId: uuid });
const parseRef = (fd: FormData) => versionRef.safeParse({ projectId: fd.get("projectId"), versionId: fd.get("versionId") });

/** Creates a secret link. Only its SHA-256 is stored; the link is shown to the owner once. */
export async function shareVersion(formData: FormData) {
  await requireOrg();
  const p = parseRef(formData);
  if (!p.success) return;
  const token = randomBytes(24).toString("base64url");
  const supabase = await createClient();
  const { data } = await supabase
    .from("visual_versions")
    .update({ share_token_hash: hashShareToken(token) })
    .eq("id", p.data.versionId)
    .select("id")
    .maybeSingle();
  if (!data) return;
  redirect(`${pathFor(p.data.projectId)}?v=${p.data.versionId}&link=${token}`);
}

export async function unshareVersion(formData: FormData) {
  await requireOrg();
  const p = parseRef(formData);
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from("visual_versions").update({ share_token_hash: null }).eq("id", p.data.versionId);
  revalidatePath(pathFor(p.data.projectId));
}

export async function deleteVersion(formData: FormData) {
  await requireOrg();
  const p = parseRef(formData);
  if (!p.success) return;
  const supabase = await createClient();
  const { data } = await supabase.from("visual_versions").delete().eq("id", p.data.versionId).select("output_key").maybeSingle();
  if (data) await objectStore(supabase, "vision-outputs").remove(data.output_key);
  redirect(pathFor(p.data.projectId));
}

export async function deleteProject(formData: FormData) {
  await requireOrg();
  const id = uuid.safeParse(formData.get("projectId"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: versions } = await supabase.from("visual_versions").select("output_key").eq("project_id", id.data);
  const { data: project } = await supabase.from("visual_projects").delete().eq("id", id.data).select("source_key").maybeSingle();
  if (project) {
    const outputs = objectStore(supabase, "vision-outputs");
    await Promise.all((versions ?? []).map((v) => outputs.remove(v.output_key)));
    await objectStore(supabase, "vision-sources").remove(project.source_key);
  }
  redirect("/vision");
}
