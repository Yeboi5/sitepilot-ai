import { isCategory } from "../domain/categories";
import { analyseExpenses, parseExpenseCsv } from "../domain/guardian";
import type { Cents } from "../domain/money";
import { currentPrice, evaluateWatch } from "../domain/monitoring";
import { ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import type { Actor, Negotiation, PriceWatch, WatchKind } from "../domain/types";
import { audit, newId, type Ctx } from "./context";
import { proposeFinalTerms } from "./transactions";

async function ownWatch(ctx: Ctx, actor: Actor, id: string): Promise<PriceWatch> {
  const w = await ctx.store.get("watches", id);
  if (!w) throw new NotFoundError("Watch");
  if (w.userId !== actor.userId) throw new ForbiddenError();
  return w;
}

export async function listWatches(ctx: Ctx, actor: Actor) {
  return (await ctx.store.list("watches", { userId: actor.userId })).filter((w) => w.active).sort((a, b) => a.label.localeCompare(b.label));
}

export async function createWatch(ctx: Ctx, actor: Actor, input: { kind: WatchKind; label: string; merchant: string; categoryId: string; priceCents: Cents; targetPriceCents?: Cents; adjustmentWindowDays?: number; renewalDate?: string; purchasedAt?: string }) {
  requireRole(actor, "customer");
  if (!isCategory(input.categoryId)) throw new ValidationError("Choose a category");
  if (!input.label.trim()) throw new ValidationError("What are you tracking?");
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) throw new ValidationError("Enter the price you paid");
  const now = ctx.now().toISOString();
  const w: PriceWatch = {
    id: newId(), userId: actor.userId, kind: input.kind, label: input.label.trim().slice(0, 120), merchant: input.merchant.trim().slice(0, 120), categoryId: input.categoryId,
    purchasePriceCents: input.priceCents, purchasedAt: input.purchasedAt || (input.kind === "retail_product" ? now : undefined), targetPriceCents: input.targetPriceCents,
    adjustmentWindowDays: input.adjustmentWindowDays, renewalDate: input.renewalDate || undefined, history: [{ at: now, cents: input.priceCents, source: "manual" }],
    dataSource: "manual", active: true, createdAt: now,
  };
  await ctx.store.insert("watches", w);
  await audit(ctx, actor, "watch.created", "watch", w.id, { kind: w.kind });
  await runChecks(ctx, actor);
  return w;
}

export async function addPricePoint(ctx: Ctx, actor: Actor, id: string, cents: Cents, source: "manual" | "simulated_feed" = "manual") {
  const w = await ownWatch(ctx, actor, id);
  if (!Number.isInteger(cents) || cents <= 0) throw new ValidationError("Enter a valid price");
  const history = [...w.history, { at: ctx.now().toISOString(), cents, source }];
  await ctx.store.update("watches", id, { history });
  await audit(ctx, actor, source === "manual" ? "watch.price_entered" : "watch.simulated_feed", "watch", id, { cents });
  return runChecks(ctx, actor);
}

/** SIMULATED FEED: moves the price as an approved price API would. Labelled in the UI. */
export async function simulateFeedTick(ctx: Ctx, actor: Actor, id: string) {
  const w = await ownWatch(ctx, actor, id);
  const price = currentPrice(w);
  const next = w.kind === "retail_product" ? Math.round((price * 0.89) / 100) * 100 - 100 : Math.round(price * 1.08);
  return addPricePoint(ctx, actor, id, Math.max(next, 100), "simulated_feed");
}

/** Evaluates all of a user's watches and stores new (de-duplicated) alerts. */
export async function runChecks(ctx: Ctx, actor: Actor) {
  const watches = await listWatches(ctx, actor);
  const existing = await ctx.store.list("alerts", { userId: actor.userId });
  const keys = new Set(existing.map((a) => `${a.watchId}:${a.kind}:${a.title}`));
  let created = 0;
  for (const w of watches) {
    for (const s of evaluateWatch(w, ctx.now())) {
      const key = `${s.watchId}:${s.kind}:${s.title}`;
      if (keys.has(key)) continue;
      keys.add(key);
      await ctx.store.insert("alerts", { ...s, id: newId(), userId: actor.userId, read: false, createdAt: ctx.now().toISOString() });
      created++;
    }
  }
  return created;
}

export async function listAlerts(ctx: Ctx, actor: Actor) {
  return (await ctx.store.list("alerts", { userId: actor.userId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markAlertRead(ctx: Ctx, actor: Actor, id: string) {
  const a = await ctx.store.get("alerts", id);
  if (!a || a.userId !== actor.userId) throw new NotFoundError("Alert");
  await ctx.store.update("alerts", id, { read: true });
}

/** Customer requests a retailer price adjustment; records a pending saving to verify once refunded. */
export async function claimPriceAdjustment(ctx: Ctx, actor: Actor, id: string) {
  requireRole(actor, "customer");
  const w = await ownWatch(ctx, actor, id);
  const price = currentPrice(w);
  if (w.kind !== "retail_product" || price >= w.purchasePriceCents) throw new ValidationError("No price drop to claim");
  const existing = (await ctx.store.list("negotiations", { customerId: actor.userId })).find((n) => n.title.startsWith(`Price adjustment: ${w.label}`) && n.state !== "cancelled");
  if (existing) throw new ValidationError("You've already recorded this claim");
  const now = ctx.now().toISOString();
  const n: Negotiation = {
    id: newId(), customerId: actor.userId, categoryId: w.categoryId, title: `Price adjustment: ${w.label}`, counterpartyName: w.merchant, mode: "advisory", state: "open",
    // Prices the customer entered are real; only the labelled simulated feed is a simulation.
    baselineCents: w.purchasePriceCents, targetCents: price, currentOfferCents: price, recurrence: "one_off", simulated: w.dataSource === "simulated_feed",
    version: 0, createdAt: now, updatedAt: now,
    messages: [{ id: newId(), at: now, from: "ai", kind: "note", amountCents: price, body: "Take your receipt to the retailer (or use their online form) and request the difference under their price-adjustment policy. Once refunded, confirm the amount to verify the saving." }],
  };
  await ctx.store.insert("negotiations", n);
  await audit(ctx, actor, "watch.adjustment_claimed", "watch", id);
  // No business on DealPilot is party to a retailer adjustment; the customer's claim is the approval.
  return proposeFinalTerms(ctx, n, { by: "customer", userId: actor.userId, priceCents: price, businessApproval: "not_applicable" });
}

export async function removeWatch(ctx: Ctx, actor: Actor, id: string) {
  await ownWatch(ctx, actor, id);
  await ctx.store.update("watches", id, { active: false });
  await audit(ctx, actor, "watch.removed", "watch", id);
}

// ─── Money Guardian ─────────────────────────────────────────────────────────

export async function importExpensesCsv(ctx: Ctx, actor: Actor, csv: string) {
  requireRole(actor, "customer");
  if (csv.length > 500_000) throw new ValidationError("CSV is too large (500 KB max)");
  const { rows, errors } = parseExpenseCsv(csv);
  for (const r of rows) {
    await ctx.store.insert("expenses", { id: newId(), userId: actor.userId, ...r, source: "csv_upload", createdAt: ctx.now().toISOString() });
  }
  await audit(ctx, actor, "guardian.csv_imported", "expenses", actor.userId, { rows: rows.length, errors: errors.length });
  return { imported: rows.length, errors };
}

export async function addExpense(ctx: Ctx, actor: Actor, input: { date: string; merchant: string; amountCents: Cents }) {
  requireRole(actor, "customer");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ValidationError("Date must be YYYY-MM-DD");
  if (!input.merchant.trim()) throw new ValidationError("Enter the merchant");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new ValidationError("Enter an amount");
  await ctx.store.insert("expenses", { id: newId(), userId: actor.userId, date: input.date, merchant: input.merchant.trim().slice(0, 80), amountCents: input.amountCents, source: "manual", createdAt: ctx.now().toISOString() });
}

export async function guardianReport(ctx: Ctx, actor: Actor) {
  const lines = await ctx.store.list("expenses", { userId: actor.userId });
  const findings = analyseExpenses(lines);
  return { lines: lines.sort((a, b) => b.date.localeCompare(a.date)), findings, potentialAnnualCents: findings.filter((f) => f.kind !== "subscription").reduce((s, f) => s + f.potentialAnnualSavingsCents, 0) };
}
