"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createDemoSession, destroySession, requireSignedIn, requireUser } from "@/lib/auth/session";
import { appUrl, authDriver, demoMode, dataDriver } from "@/lib/config";
import { isCategory } from "@/lib/domain/categories";
import { ValidationError } from "@/lib/domain/permissions";
import { authenticate, signUp } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { enforceRateLimit } from "@/lib/services/rate-limit";
import { resetDemoStore } from "@/lib/store";
import { DEMO_PASSWORD } from "@/lib/store/seed";
import { supabaseServer } from "@/lib/supabase/server";
import { act, str } from "./helpers";

const home = (role: string) => (role === "business" ? "/biz" : role === "admin" ? "/admin" : "/app");

/** Only allow same-site relative redirects. */
function safeNext(next: string, role: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : home(role);
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

async function passwordSignIn(email: string, password: string) {
  const ctx = await appCtx();
  await enforceRateLimit(ctx, "signIn", `ip:${await clientIp()}`, `email:${email.toLowerCase()}`);
  if (authDriver() === "supabase") {
    const { data, error } = await (await supabaseServer()).auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      // Distinguish only the case the user can act on; never reveal whether an account exists.
      throw new ValidationError(error?.code === "email_not_confirmed" ? "Please confirm your email first — check your inbox for the link." : "Email or password is incorrect");
    }
    const profile = await ctx.store.get("users", data.user.id);
    return profile?.role ?? "customer";
  }
  const user = await authenticate(ctx, email, password);
  await createDemoSession(user.id);
  return user.role;
}

export async function signInAction(fd: FormData) {
  const next = str(fd, "next");
  await act(() => passwordSignIn(str(fd, "email"), str(fd, "password")), (role) => safeNext(next, role), "/sign-in");
}

/** One-click demo sign-in: demonstration environments only, seeded demo accounts only. */
export async function demoSignInAction(fd: FormData) {
  await act(async () => {
    if (!demoMode()) throw new ValidationError("Demo sign-in is disabled");
    const email = str(fd, "email");
    if (!email.endsWith("@demo.dealpilot.test")) throw new ValidationError("Not a demo account");
    return passwordSignIn(email, DEMO_PASSWORD);
  }, (role) => safeNext(str(fd, "next"), role), "/sign-in");
}

export async function signUpAction(fd: FormData) {
  const role = str(fd, "role") === "business" ? "business" : "customer";
  const input = {
    name: str(fd, "name"), email: str(fd, "email").toLowerCase(), password: str(fd, "password"), role, region: str(fd, "region"),
    businessName: str(fd, "businessName"), categories: fd.getAll("categories").map(String).filter(isCategory),
  } as const;
  await act(async () => {
    const ctx = await appCtx();
    await enforceRateLimit(ctx, "signUp", `ip:${await clientIp()}`);
    if (authDriver() === "supabase") {
      if (input.password.length < 10) throw new ValidationError("Use at least 10 characters for your password");
      if (!input.name) throw new ValidationError("Enter your name");
      if (role === "business" && (!input.businessName || !input.categories.length)) throw new ValidationError("Enter your business name and at least one category");
      const { error } = await (await supabaseServer()).auth.signUp({
        email: input.email, password: input.password,
        options: {
          emailRedirectTo: `${appUrl()}/auth/confirm`,
          // Role is limited to customer|business by the database trigger; admin can't be requested.
          data: { name: input.name, role, region: input.region, business_name: input.businessName, categories: input.categories },
        },
      });
      // Same response whether or not the email is already registered (no account enumeration).
      if (error && error.code !== "user_already_exists") throw new ValidationError(error.message);
      return "/sign-up/check-email";
    }
    const user = await signUp(ctx, input);
    await createDemoSession(user.id);
    return home(user.role);
  }, (dest) => dest, `/sign-up${role === "business" ? "?role=business" : ""}`);
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

export async function resetDemoAction() {
  const { user } = await requireUser("admin");
  if (!user.isDemo || dataDriver() !== "memory") redirect("/admin");
  await act(async () => { await resetDemoStore(); await destroySession(); }, () => "/sign-in", "/admin", "Demo data reset to its original state");
}

// ─── MFA (TOTP) ─────────────────────────────────────────────────────────────

/** Starts TOTP enrolment and returns the QR code to the client component (the secret never goes in a URL). */
export async function startMfaEnrollment(): Promise<{ factorId: string; qrCode: string; secret: string } | { error: string }> {
  await requireSignedIn();
  if (authDriver() !== "supabase") return { error: "Two-step verification needs Supabase Auth (not available in the in-memory demo)." };
  const sb = await supabaseServer();
  // Clean up abandoned, unverified factors first so enrolment can be retried.
  const { data: factors } = await sb.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) if (f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `DealPilot ${Date.now()}` });
  if (error || !data) return { error: error?.message ?? "Could not start enrolment" };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfaAction(fd: FormData) {
  const state = await requireSignedIn();
  const factorId = str(fd, "factorId");
  const code = str(fd, "code").replace(/\s/g, "");
  const back = str(fd, "back") || "/mfa/verify";
  await act(async () => {
    if (!/^\d{6}$/.test(code)) throw new ValidationError("Enter the 6-digit code from your authenticator app");
    await enforceRateLimit(await appCtx(), "mfaVerify", `user:${state.user.id}`);
    const sb = await supabaseServer();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw new ValidationError("That code didn't work. Check your device's clock and try again.");
    return home(state.user.role);
  }, (dest) => dest, back, "Two-step verification confirmed");
}

// ─── Privacy (any role) ─────────────────────────────────────────────────────

export async function setAiConsentAction(fd: FormData) {
  const { actor, user } = await requireUser();
  const back = user.role === "business" ? "/biz/profile" : "/app/settings";
  const { setAiConsent } = await import("@/lib/services/accounts");
  await act(async () => setAiConsent(await appCtx(), actor, fd.get("consent") === "on"), () => back, back, "Privacy settings saved");
}

export async function deleteAccountAction(fd: FormData) {
  const { actor, user } = await requireUser();
  const back = user.role === "business" ? "/biz/profile" : "/app/settings";
  const { deleteMyAccount } = await import("@/lib/services/privacy");
  await act(async () => {
    const ctx = await appCtx();
    const disable = authDriver() === "supabase"
      ? async (id: string, email: string) => { const { SupabaseStore } = await import("@/lib/store/supabase"); await new SupabaseStore().disableAuthUser(id, email); }
      : undefined;
    await deleteMyAccount(ctx, actor, str(fd, "confirmEmail"), disable);
    await destroySession();
  }, () => "/?notice=Your%20account%20was%20deleted", back);
}
