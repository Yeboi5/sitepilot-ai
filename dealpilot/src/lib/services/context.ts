import { randomUUID } from "node:crypto";
import { MockAIProvider } from "../ai/mock";
import type { AIProvider } from "../ai/types";
import type { EmailProvider } from "../integrations/notifications";
import type { Scanner } from "../integrations/scanner";
import type { FeeConfig } from "../domain/savings";
import type { Actor, Alert, AuditLog } from "../domain/types";
import type { Store } from "../store/types";

/** Everything a service needs. Built per request in the app; built by hand in tests. */
export interface Ctx {
  store: Store;
  ai: AIProvider;
  fees: FeeConfig;
  now: () => Date;
  /** Malware scanner for uploads. Defaults to the built-in baseline checks. */
  scanner?: Scanner;
  /** Email delivery for notifications. Without it, notifications are in-app only. */
  email?: { provider: EmailProvider; appUrl: string };
}

export const newId = () => randomUUID();

export async function audit(ctx: Ctx, actor: Actor | "system", action: string, entityType: string, entityId: string, detail?: Record<string, unknown>) {
  const row: AuditLog = {
    id: newId(),
    at: ctx.now().toISOString(),
    actorId: actor === "system" ? "system" : actor.userId,
    actorRole: actor === "system" ? "system" : actor.role,
    action,
    entityType,
    entityId,
    detail,
  };
  await ctx.store.insert("audit", row);
}

/**
 * In-app alert, plus an email when email is configured. Email failures are logged and never
 * break the action that triggered them. Demo accounts are never emailed.
 */
export async function notify(ctx: Ctx, userId: string, a: Omit<Alert, "id" | "userId" | "read" | "createdAt">) {
  await ctx.store.insert("alerts", { ...a, id: newId(), userId, read: false, createdAt: ctx.now().toISOString() });
  if (!ctx.email) return;
  const user = await ctx.store.get("users", userId);
  const log = (status: "sent" | "failed" | "skipped", error?: string) =>
    ctx.store.insert("notifications", { id: newId(), userId, channel: "email", template: a.kind, status, provider: ctx.email!.provider.name, error, createdAt: ctx.now().toISOString() }).catch(() => undefined);
  if (!user || user.isDemo || user.deletedAt) return log("skipped", user?.isDemo ? "demo account" : "no recipient");
  try {
    const link = a.href ? `\n\nOpen in DealPilot: ${ctx.email.appUrl}${a.href}` : "";
    await ctx.email.provider.send({ to: user.email, subject: `DealPilot: ${a.title}`, text: `${a.body}${link}\n\nYou're receiving this because you have a DealPilot account.` });
    await log("sent");
  } catch (e) {
    await log("failed", e instanceof Error ? e.message.slice(0, 300) : "send failed");
  }
}

const offline: AIProvider = new MockAIProvider();

/**
 * The AI provider to use for this user's data: the configured provider when it's the offline
 * mock or the user consented to AI processing; otherwise the offline drafter.
 */
export async function aiFor(ctx: Ctx, userId: string): Promise<AIProvider> {
  if (ctx.ai.simulated) return ctx.ai;
  const u = await ctx.store.get("users", userId);
  return u?.aiProcessingConsent ? ctx.ai : offline;
}
