import { formatMoney, type Cents } from "../domain/money";
import { transition } from "../domain/negotiation";
import { ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import { calculateFee, calculateSavings, summariseSavings } from "../domain/savings";
import type { Actor, LedgerEntry, Negotiation, Transaction, VerificationMethod } from "../domain/types";
import { audit, newId, notify, type Ctx } from "./context";

async function ledger(ctx: Ctx, e: Omit<LedgerEntry, "id" | "createdAt" | "currency">) {
  // The idempotency key is unique in both drivers: a retried call can't double-record or double-charge.
  await ctx.store.insert("ledger", { ...e, id: newId(), currency: ctx.fees.currency, createdAt: ctx.now().toISOString() });
}

/**
 * Called when a negotiation reaches "agreed". Creates a transaction that is
 * PENDING VERIFICATION: savings are not counted, and no fee is due, until the
 * customer confirms the final invoice.
 */
export async function recordAgreement(ctx: Ctx, n: Negotiation): Promise<Negotiation> {
  if (n.state !== "agreed" || n.agreedCents === undefined) throw new ValidationError("Negotiation is not agreed");
  const existing = (await ctx.store.list("transactions", { negotiationId: n.id }))[0];
  if (existing) return n;
  const s = calculateSavings(n.baselineCents, n.agreedCents, n.recurrence);
  const tx: Transaction = {
    id: newId(), customerId: n.customerId, businessId: n.businessId, categoryId: n.categoryId, description: n.title,
    requestId: n.requestId, offerId: n.offerId, negotiationId: n.id, baselineCents: n.baselineCents, finalCents: n.agreedCents,
    recurrence: n.recurrence, periodSavingsCents: s.periodSavingsCents, annualSavingsCents: s.annualSavingsCents,
    status: "pending_verification", feeCents: 0, feeStatus: s.isSaving ? "pending" : "not_applicable", simulated: n.simulated, createdAt: ctx.now().toISOString(),
  };
  await ctx.store.insert("transactions", tx);
  await ledger(ctx, { transactionId: tx.id, userId: n.customerId, type: "saving_recorded", amountCents: s.periodSavingsCents, idempotencyKey: `saving:${tx.id}`, simulated: n.simulated, note: "Unverified — pending customer confirmation" });

  if (n.offerId) {
    await ctx.store.update("offers", n.offerId, { status: "accepted", priceCents: n.agreedCents, updatedAt: ctx.now().toISOString() });
  }
  if (n.requestId) {
    await ctx.store.update("requests", n.requestId, { status: "awarded" });
    for (const o of await ctx.store.list("offers", { requestId: n.requestId })) {
      if (o.id !== n.offerId && ["submitted", "countered"].includes(o.status)) await ctx.store.update("offers", o.id, { status: "declined", updatedAt: ctx.now().toISOString() });
    }
  }
  await audit(ctx, "system", "transaction.recorded", "transaction", tx.id, { negotiationId: n.id, periodSavingsCents: s.periodSavingsCents });
  return n;
}

/** Accept a marketplace offer as-is, without negotiating. */
export async function acceptOfferDirectly(ctx: Ctx, actor: Actor, offerId: string, confirmed: boolean): Promise<Transaction> {
  requireRole(actor, "customer");
  if (!confirmed) throw new ValidationError("Please confirm you want to accept this offer");
  const offer = await ctx.store.get("offers", offerId);
  if (!offer) throw new NotFoundError("Offer");
  const req = await ctx.store.get("requests", offer.requestId);
  if (!req || req.customerId !== actor.userId) throw new ForbiddenError();
  if (!["submitted", "countered"].includes(offer.status)) throw new ValidationError("This offer can no longer be accepted");
  if (["awarded", "completed", "cancelled"].includes(req.status)) throw new ValidationError("This request is already closed");
  const business = (await ctx.store.get("businesses", offer.businessId))!;
  const now = ctx.now().toISOString();
  const n: Negotiation = {
    id: newId(), customerId: actor.userId, categoryId: req.categoryId, title: `${req.title} — ${business.name}`, requestId: req.id, offerId, businessId: business.id,
    counterpartyName: business.name, mode: "approval", state: "agreed", baselineCents: req.baselineCents, targetCents: offer.priceCents,
    currentOfferCents: offer.priceCents, agreedCents: offer.priceCents, recurrence: req.recurrence, simulated: offer.isSimulated, createdAt: now, updatedAt: now,
    messages: [{ id: newId(), at: now, from: "customer", kind: "decision", amountCents: offer.priceCents, body: `You accepted the offer at ${formatMoney(offer.priceCents)}.` }],
  };
  await ctx.store.insert("negotiations", n);
  await recordAgreement(ctx, n);
  await audit(ctx, actor, "offer.accepted", "offer", offerId, { priceCents: offer.priceCents });
  if (business.ownerId && !business.isSimulated) await notify(ctx, business.ownerId, { kind: "offer", title: `Offer accepted: ${req.title}`, body: `At ${formatMoney(offer.priceCents)}.`, href: `/biz/transactions` });
  return (await ctx.store.list("transactions", { negotiationId: n.id }))[0];
}

/**
 * Customer confirms the deal happened at the final invoiced amount. Savings
 * are recalculated from the confirmed amount (not the negotiated one) so they
 * can't be overstated. The success fee is calculated only now.
 */
export async function verifyTransaction(
  ctx: Ctx, actor: Actor, txId: string,
  input: { method: VerificationMethod; finalCents: Cents; evidenceDocumentId?: string; confirmed: boolean },
): Promise<Transaction> {
  requireRole(actor, "customer", "admin");
  if (!input.confirmed) throw new ValidationError("Please confirm the details are correct");
  const tx = await ctx.store.get("transactions", txId);
  if (!tx) throw new NotFoundError("Transaction");
  if (actor.role === "customer" && tx.customerId !== actor.userId) throw new ForbiddenError();
  if (tx.status !== "pending_verification") throw new ValidationError("This transaction has already been resolved");
  if (!Number.isInteger(input.finalCents) || input.finalCents <= 0) throw new ValidationError("Enter the final amount on your invoice");
  if (input.evidenceDocumentId) {
    const doc = await ctx.store.get("documents", input.evidenceDocumentId);
    if (!doc || doc.ownerId !== tx.customerId) throw new ForbiddenError("Evidence document not found");
  }
  const s = calculateSavings(tx.baselineCents, input.finalCents, tx.recurrence);
  const verified: Transaction = {
    ...tx, finalCents: input.finalCents, periodSavingsCents: s.periodSavingsCents, annualSavingsCents: s.annualSavingsCents,
    status: "verified", verificationMethod: input.method, evidenceDocumentId: input.evidenceDocumentId, verifiedAt: ctx.now().toISOString(), verifiedBy: actor.userId,
  };
  const fee = calculateFee(verified, ctx.fees);
  verified.feeCents = fee.feeCents;
  verified.feeStatus = fee.feeCents > 0 ? "charged_simulated" : "waived";
  await ctx.store.update("transactions", tx.id, verified);

  await ledger(ctx, { transactionId: tx.id, userId: tx.customerId, type: "saving_verified", amountCents: s.periodSavingsCents, idempotencyKey: `verified:${tx.id}`, simulated: tx.simulated });
  if (fee.feeCents > 0) {
    await ledger(ctx, { transactionId: tx.id, userId: tx.customerId, type: "fee_charged", amountCents: fee.feeCents, idempotencyKey: `fee:${tx.id}`, simulated: true, note: `Simulated payment — no real charge. ${fee.reason}` });
  } else {
    await ledger(ctx, { transactionId: tx.id, userId: tx.customerId, type: "fee_waived", amountCents: 0, idempotencyKey: `fee:${tx.id}`, simulated: true, note: fee.reason });
  }

  if (tx.negotiationId) {
    const n = await ctx.store.get("negotiations", tx.negotiationId);
    if (n && n.state === "agreed") await ctx.store.update("negotiations", n.id, { state: transition(n.state, "COMPLETE"), updatedAt: ctx.now().toISOString() });
  }
  if (tx.requestId) await ctx.store.update("requests", tx.requestId, { status: "completed" });
  await audit(ctx, actor, "transaction.verified", "transaction", tx.id, { method: input.method, finalCents: input.finalCents, feeCents: fee.feeCents });
  if (tx.businessId) {
    const b = await ctx.store.get("businesses", tx.businessId);
    if (b?.ownerId && !b.isSimulated) await notify(ctx, b.ownerId, { kind: "offer", title: "Job verified complete", body: tx.description, href: "/biz/transactions" });
  }
  return verified;
}

/** The deal fell through. No saving is counted and no fee is charged. */
export async function cancelTransaction(ctx: Ctx, actor: Actor, txId: string, reason: string): Promise<Transaction> {
  const tx = await ctx.store.get("transactions", txId);
  if (!tx) throw new NotFoundError("Transaction");
  if (actor.role !== "admin" && tx.customerId !== actor.userId) throw new ForbiddenError();
  if (tx.status !== "pending_verification") throw new ValidationError("Only pending transactions can be cancelled");
  const updated = await ctx.store.update("transactions", tx.id, { status: "cancelled", feeStatus: "not_applicable", feeCents: 0 });
  if (tx.negotiationId) {
    const n = await ctx.store.get("negotiations", tx.negotiationId);
    if (n && n.state === "agreed") await ctx.store.update("negotiations", n.id, { state: transition(n.state, "CANCEL"), updatedAt: ctx.now().toISOString() });
  }
  await audit(ctx, actor, "transaction.cancelled", "transaction", tx.id, { reason: reason.slice(0, 300) });
  return updated;
}

export async function listCustomerTransactions(ctx: Ctx, actor: Actor) {
  const txs = (await ctx.store.list("transactions", { customerId: actor.userId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { transactions: txs, summary: summariseSavings(txs) };
}

export async function listBusinessTransactions(ctx: Ctx, actor: Actor) {
  requireRole(actor, "business");
  return (await ctx.store.list("transactions", { businessId: actor.businessId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listLedger(ctx: Ctx, actor: Actor) {
  const rows = actor.role === "admin" ? await ctx.store.list("ledger") : await ctx.store.list("ledger", { userId: actor.userId });
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
