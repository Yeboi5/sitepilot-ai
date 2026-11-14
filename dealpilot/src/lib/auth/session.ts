import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authDriver, mfaRequiredRoles, sessionSecret } from "../config";
import type { Actor, Role, User } from "../domain/types";
import { ensureBusinessOnboarded } from "../services/accounts";
import { appCtx } from "../services/app-context";
import { getStore } from "../store";
import { supabaseServer } from "../supabase/server";
import { signSession, verifySession } from "./token";

/**
 * Two authentication drivers:
 *  - "supabase": Supabase Auth (email verification, MFA/AAL2, refresh tokens in httpOnly cookies).
 *  - "demo": signed cookie sessions for the in-memory demonstration only.
 */
const COOKIE = "dp_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function createDemoSession(userId: string) {
  if (authDriver() !== "demo") throw new Error("Demo sessions are only available with the memory driver");
  const token = signSession({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE }, sessionSecret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function destroySession() {
  if (authDriver() === "supabase") await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(COOKIE);
}

export interface AuthState {
  user: User;
  /** Supabase only: current and required authenticator assurance level. */
  aal?: { current: string | null; next: string | null };
}

export async function getAuthState(): Promise<AuthState | null> {
  const store = await getStore();
  if (authDriver() === "supabase") {
    const sb = await supabaseServer();
    // getUser() validates the JWT with Supabase Auth (getSession() alone would trust the cookie).
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return null;
    let profile = await store.get("users", data.user.id);
    if (!profile || profile.deletedAt) return null;
    if (profile.role === "business" && !profile.businessId) {
      profile = await ensureBusinessOnboarded(await appCtx(), profile, data.user.user_metadata ?? {});
    }
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return { user: profile, aal: { current: aal?.currentLevel ?? null, next: aal?.nextLevel ?? null } };
  }
  const payload = verifySession((await cookies()).get(COOKIE)?.value, sessionSecret());
  if (!payload) return null;
  const user = await store.get("users", payload.uid);
  return user && !user.deletedAt ? { user } : null;
}

export async function getCurrentUser(): Promise<User | null> {
  return (await getAuthState())?.user ?? null;
}

export function toActor(u: User): Actor {
  return { userId: u.id, role: u.role, businessId: u.businessId };
}

const homeFor = (role: Role) => (role === "business" ? "/biz" : role === "admin" ? "/admin" : "/app");

/**
 * Use in server components and actions. Redirects when signed out, when the role is wrong, or
 * when MFA is enrolled (or required for the role) but this session hasn't completed it.
 */
export async function requireUser(...roles: Role[]): Promise<{ user: User; actor: Actor }> {
  const state = await getAuthState();
  if (!state) redirect("/sign-in");
  const { user, aal } = state;
  if (aal) {
    if (aal.next === "aal2" && aal.current !== "aal2") redirect("/mfa/verify");
    if (mfaRequiredRoles().includes(user.role) && aal.next !== "aal2") redirect("/mfa/setup?required=1");
  }
  if (roles.length && !roles.includes(user.role)) redirect(homeFor(user.role));
  return { user, actor: toActor(user) };
}

/** Signed in, MFA not enforced: for the MFA pages themselves. */
export async function requireSignedIn(): Promise<AuthState> {
  const state = await getAuthState();
  if (!state) redirect("/sign-in");
  return state;
}
