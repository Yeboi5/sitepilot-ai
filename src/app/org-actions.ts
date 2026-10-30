"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ORG_COOKIE, getSessionContext, homePathFor } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, organisationSchema, type FormState } from "@/lib/validation";

async function setActiveOrgCookie(orgId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function createOrganisation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = organisationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organisation", {
    org_name: parsed.data.name,
    org_type: parsed.data.type,
  });
  if (error || !orgId) return { error: "We couldn't create the organisation. Please try again." };

  await setActiveOrgCookie(orgId);
  redirect(homePathFor(parsed.data.type));
}

export async function switchOrganisation(formData: FormData) {
  const orgId = String(formData.get("organisationId") ?? "");
  const ctx = await getSessionContext();
  const membership = ctx?.memberships.find((m) => m.organisation.id === orgId);
  if (!membership) redirect("/dashboard");
  await setActiveOrgCookie(membership.organisation.id);
  redirect(homePathFor(membership.organisation.type));
}

/** One-click path for home buyers and investors who land on onboarding. */
export async function continueWithPersonalWorkspace() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/sign-in");
  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("ensure_personal_workspace");
  if (error || !orgId) redirect("/onboarding?error=workspace");
  await setActiveOrgCookie(orgId);
  redirect("/");
}
