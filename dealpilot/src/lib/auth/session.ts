import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionSecret } from "../config";
import type { Actor, Role, User } from "../domain/types";
import { getStore } from "../store";
import { signSession, verifySession } from "./token";

const COOKIE = "dp_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function createSession(userId: string) {
  const token = signSession({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE }, sessionSecret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const payload = verifySession(token, sessionSecret());
  if (!payload) return null;
  const store = await getStore();
  return (await store.get("users", payload.uid)) ?? null;
}

export function toActor(u: User): Actor {
  return { userId: u.id, role: u.role, businessId: u.businessId };
}

/** Use in server components and actions. Redirects when signed out or wrong role. */
export async function requireUser(...roles: Role[]): Promise<{ user: User; actor: Actor }> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (roles.length && !roles.includes(user.role)) redirect(user.role === "business" ? "/biz" : user.role === "admin" ? "/admin" : "/app");
  return { user, actor: toActor(user) };
}
