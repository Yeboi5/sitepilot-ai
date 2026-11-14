import { ACTIVE_STATES } from "../domain/negotiation";
import { ValidationError } from "../domain/permissions";
import type { Actor } from "../domain/types";
import { audit, type Ctx } from "./context";
import { redactForBusiness } from "./negotiations";
import { enforceRateLimit } from "./rate-limit";

/**
 * Australian Privacy Principles: access (APP 12) and deletion on request. Financial records
 * (transactions, ledger, audit) are retained in anonymised form because they are needed for
 * tax and dispute records; everything else personal is removed.
 */
export async function exportMyData(ctx: Ctx, actor: Actor) {
  await enforceRateLimit(ctx, "dataExport", `user:${actor.userId}`);
  const user = await ctx.store.get("users", actor.userId);
  if (!user) throw new ValidationError("Account not found");
  const { passwordHash: _hidden, ...profile } = user;
  const byCustomer = { customerId: actor.userId };
  const business = user.businessId ? await ctx.store.get("businesses", user.businessId) : undefined;
  const [documents, requests, negotiations, transactions, ledger, alerts, expenses, watches, reviews, auditTrail] = await Promise.all([
    ctx.store.list("documents", { ownerId: actor.userId }),
    ctx.store.list("requests", byCustomer),
    actor.role === "business" ? ctx.store.list("negotiations", { businessId: user.businessId }) : ctx.store.list("negotiations", byCustomer),
    actor.role === "business" ? ctx.store.list("transactions", { businessId: user.businessId }) : ctx.store.list("transactions", byCustomer),
    ctx.store.list("ledger", { userId: actor.userId }),
    ctx.store.list("alerts", { userId: actor.userId }),
    ctx.store.list("expenses", { userId: actor.userId }),
    ctx.store.list("watches", { userId: actor.userId }),
    ctx.store.list("reviews", byCustomer),
    ctx.store.list("audit", { actorId: actor.userId }),
  ]);
  await audit(ctx, actor, "privacy.data_exported", "user", actor.userId);
  return {
    exportedAt: ctx.now().toISOString(),
    notice: "Your DealPilot data. Document files can be downloaded individually from the Documents page.",
    profile,
    business,
    businessCredentials: business ? await ctx.store.list("credentials", { businessId: business.id }) : [],
    offers: business ? await ctx.store.list("offers", { businessId: business.id }) : [],
    documents: documents.map(({ storageKey: _k, ...d }) => d),
    requests,
    // A business sees negotiations exactly as it does in the app (no customer targets or AI notes).
    negotiations: actor.role === "business" ? negotiations.map(redactForBusiness) : negotiations,
    transactions, ledger, alerts, expenses, priceWatches: watches, reviews, activity: auditTrail,
  };
}

export async function deleteMyAccount(ctx: Ctx, actor: Actor, confirmEmail: string, disableAuth?: (userId: string, email: string) => Promise<void>) {
  const user = await ctx.store.get("users", actor.userId);
  if (!user || user.deletedAt) throw new ValidationError("Account not found");
  if (confirmEmail.trim().toLowerCase() !== user.email) throw new ValidationError("Type your email address exactly to confirm");
  if (user.role === "admin") throw new ValidationError("Administrator accounts are removed by another administrator");
  const pending = (await ctx.store.list("transactions", { customerId: actor.userId })).filter((t) => t.status === "pending_verification");
  if (pending.length) throw new ValidationError("Verify or cancel your pending deals first, so businesses aren't left waiting");

  const now = ctx.now().toISOString();
  // Personal content: removed.
  for (const d of await ctx.store.list("documents", { ownerId: actor.userId })) {
    await ctx.store.deleteBlob(d.storageKey).catch(() => undefined);
    await ctx.store.update("documents", d.id, { filename: "deleted", analysis: null as never, confirmed: null as never });
  }
  for (const w of await ctx.store.list("watches", { userId: actor.userId })) await ctx.store.update("watches", w.id, { active: false, label: "deleted", merchant: "deleted" });
  for (const e of await ctx.store.list("expenses", { userId: actor.userId })) await ctx.store.update("expenses", e.id, { merchant: "deleted" });
  for (const r of await ctx.store.list("requests", { customerId: actor.userId })) {
    if (["open", "negotiating"].includes(r.status)) await ctx.store.update("requests", r.id, { status: "cancelled" });
  }
  for (const n of await ctx.store.list("negotiations", { customerId: actor.userId })) {
    if (ACTIVE_STATES.includes(n.state) && n.state !== "agreed") await ctx.store.update("negotiations", n.id, { state: "cancelled", version: n.version + 1 });
  }
  for (const g of (await ctx.store.list("groups")).filter((x) => x.memberIds.includes(actor.userId))) {
    await ctx.store.update("groups", g.id, { memberIds: g.memberIds.filter((m) => m !== actor.userId) });
  }
  // Identity: anonymised. Financial records keep pointing at this (now anonymous) profile.
  const anonymisedEmail = `deleted+${user.id}@deleted.invalid`;
  await ctx.store.update("users", user.id, { name: "Deleted user", email: anonymisedEmail, region: "", deletedAt: now, aiProcessingConsent: false });
  if (user.businessId) await ctx.store.update("businesses", user.businessId, { verificationStatus: "suspended", statusReason: "Account deleted" });
  if (disableAuth) await disableAuth(user.id, anonymisedEmail);
  await audit(ctx, actor, "privacy.account_deleted", "user", user.id);
}
