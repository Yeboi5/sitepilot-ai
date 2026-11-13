import { randomUUID } from "node:crypto";
import type { AIProvider } from "../ai/types";
import type { FeeConfig } from "../domain/savings";
import type { Actor, Alert, AuditLog } from "../domain/types";
import type { Store } from "../store/types";

/** Everything a service needs. Built per request in the app; built by hand in tests. */
export interface Ctx {
  store: Store;
  ai: AIProvider;
  fees: FeeConfig;
  now: () => Date;
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

export async function notify(ctx: Ctx, userId: string, a: Omit<Alert, "id" | "userId" | "read" | "createdAt">) {
  await ctx.store.insert("alerts", { ...a, id: newId(), userId, read: false, createdAt: ctx.now().toISOString() });
}
