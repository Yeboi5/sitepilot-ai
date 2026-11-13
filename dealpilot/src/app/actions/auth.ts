"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { dataDriver } from "@/lib/config";
import { ValidationError } from "@/lib/domain/permissions";
import { authenticate, signUp } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { resetDemoStore } from "@/lib/store";
import { DEMO_PASSWORD } from "@/lib/store/seed";
import { act, str } from "./helpers";

const home = (role: string) => (role === "business" ? "/biz" : role === "admin" ? "/admin" : "/app");

/** Only allow same-site relative redirects. */
function safeNext(next: string, role: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : home(role);
}

export async function signInAction(fd: FormData) {
  const next = str(fd, "next");
  await act(
    async () => {
      const ctx = await appCtx();
      const user = await authenticate(ctx, str(fd, "email"), str(fd, "password"));
      await createSession(user.id);
      return user;
    },
    (u) => safeNext(next, u.role),
    "/sign-in",
  );
}

/** One-click demo sign-in. Only for seeded demo accounts, and only with the memory driver. */
export async function demoSignInAction(fd: FormData) {
  await act(
    async () => {
      if (dataDriver() !== "memory") throw new ValidationError("Demo sign-in is disabled");
      const email = str(fd, "email");
      if (!email.endsWith("@demo.dealpilot.test")) throw new ValidationError("Not a demo account");
      const ctx = await appCtx();
      const user = await authenticate(ctx, email, DEMO_PASSWORD);
      await createSession(user.id);
      return user;
    },
    (u) => safeNext(str(fd, "next"), u.role),
    "/sign-in",
  );
}

export async function signUpAction(fd: FormData) {
  await act(
    async () => {
      const ctx = await appCtx();
      const user = await signUp(ctx, {
        name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password"), role: str(fd, "role") === "business" ? "business" : "customer",
        region: str(fd, "region"), businessName: str(fd, "businessName"), categories: fd.getAll("categories").map(String),
      });
      await createSession(user.id);
      return user;
    },
    (u) => home(u.role),
    "/sign-up",
  );
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

export async function resetDemoAction() {
  const { user } = await requireUser();
  if (!user.isDemo) redirect("/");
  await act(async () => { await resetDemoStore(); await destroySession(); }, () => "/sign-in", "/admin", "Demo data reset to its original state");
}
