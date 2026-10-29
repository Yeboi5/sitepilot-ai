import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export const ACTIVE_ORG_COOKIE = "sp_active_org";

export type OrgMembership = {
  role: Enums<"membership_role">;
  organisation: Pick<Tables<"organisations">, "id" | "name" | "type" | "verification_status">;
};

export type SessionContext = {
  authId: string;
  email: string | null;
  user: Pick<Tables<"users">, "id" | "display_name">;
  memberships: OrgMembership[];
  /** Organisation the user is currently working in; null until onboarding is complete. */
  active: OrgMembership | null;
  /** Authenticator assurance level from the JWT ("aal1" password, "aal2" MFA). */
  aal: string | null;
};

/**
 * Resolves the signed-in user, their memberships and the active organisation for this
 * request. All lookups go through RLS with the user's own JWT.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data: user } = await supabase
    .from("users")
    .select("id, display_name")
    .eq("auth_id", claims.sub)
    .single();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("memberships")
    .select("role, organisation:organisations!inner(id, name, type, verification_status)")
    .eq("user_id", user.id)
    .order("created_at");

  const memberships: OrgMembership[] = (rows ?? []).map((r) => ({ role: r.role, organisation: r.organisation }));
  const requested = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  // The cookie is only a preference: it is honoured only if the user really is a member.
  const active = memberships.find((m) => m.organisation.id === requested) ?? memberships[0] ?? null;

  return {
    authId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user,
    memberships,
    active,
    aal: typeof claims.aal === "string" ? claims.aal : null,
  };
});

/** For pages that need a signed-in user with an organisation of the given type. */
export async function requireOrg(type?: Enums<"organisation_type">) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.active) redirect("/onboarding");
  if (type && ctx.active.organisation.type !== type) redirect("/dashboard");
  return ctx as SessionContext & { active: OrgMembership };
}

export function homePathFor(type: Enums<"organisation_type">) {
  return type === "investor" ? "/investor" : "/firm";
}
