import { formatMoney, type Cents } from "../domain/money";
import { pendingApprovals, termsFullyApproved } from "../domain/negotiation";
import { canViewNegotiation, ConflictError, ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import { assessFee, calculateSavings, summariseSavings } from "../domain/savings";
import type { Actor, FinalTerms, LedgerEntry, Negotiation, NegotiationMessage, Transaction, VerificationMethod } from "../domain/types";
import { ins, upd, type BatchOp } from "../store/types";
import { audit, newId, notify, type Ctx } from "./context";
import { applyNegotiation, msg, negotiationWrite, nextNegotiation, per } from "./negotiation-store";

function ledgerRow(ctx: Ctx, e: Omit<LedgerEntry, "id" | "createdAt" | "currency">): LedgerEntry {
  return { ...e, id: newId(), currency: ctx.fees.currency, createdAt: ctx.now().toISOString() };
}

/** Business-side approval rule for a negotiation's final terms. */
export function businessApprovalFor(n: Negotiation): FinalTerms["businessApproval"] {
  if (n.simulated) return "simulated";
  if (!n.businessId) return "not_applicable";
  return "required";
}

async function assertBusinessCanAct(ctx: Ctx, businessId: string) {
  const b = await ctx.store.get("businesses", businessId);
  if (!b) throw new NotFoundError("Business");
  if (b.verificationStatus !== "verified") throw new ForbiddenError(b.verificationStatus === "suspended" ? "Your business is suspended" : "Your business must be verified before agreeing deals");
}

/**
 * One side accepts a price. The negotiation moves to `final_approval` and records that side's
 * approval of the final terms. When both sides have approved (or the business side is formally
 * exempt — simulated, external retailer, or a pre-approved group offer), the deal is finalised.
 */
export async function proposeFinalTerms(
  ctx: Ctx, n: Negotiation,
  opts: { by: "customer" | "business" | "autopilot"; userId: string; priceCents: Cents; businessApproval?: FinalTerms["businessApproval"]; messages?: NegotiationMessage[] },
): Promise<Negotiation> {
  const now = ctx.now().toISOString();
  const offer = n.offerId ? await ctx.store.get("offers", n.offerId) : undefined;
  const terms: FinalTerms = {
    priceCents: opts.priceCents, recurrence: n.recurrence, scope: offer?.scope, warrantyMonths: offer?.warrantyMonths, completionDays: offer?.completionDays,
    proposedBy: opts.by === "business" ? "business" : "customer",
    businessApproval: opts.businessApproval ?? businessApprovalFor(n),
    // Limited Autopilot may propose but never approves final terms for the customer.
    ...(opts.by === "customer" ? { customerApprovedAt: now, customerApprovedBy: opts.userId } : {}),
    ...(opts.by === "business" ? { businessApprovedAt: now, businessApprovedBy: opts.userId } : {}),
  };
  const proposed = await applyNegotiation(ctx, n, "ACCEPT", { finalTerms: terms, agreedCents: opts.priceCents, currentOfferCents: opts.priceCents }, opts.messages ?? []);
  await audit(ctx, opts.by === "business" ? { userId: opts.userId, role: "business" } : { userId: opts.userId, role: "customer" }, "terms.proposed", "negotiation", n.id, { priceCents: opts.priceCents, by: opts.by, businessApproval: terms.businessApproval });
  if (termsFullyApproved(terms)) return finaliseAgreement(ctx, proposed);
  const waitingOn = pendingApprovals(terms);
  if (waitingOn.includes("customer")) {
    await notify(ctx, n.customerId, { kind: "negotiation", title: `Approve final terms: ${formatMoney(opts.priceCents)}${per(n.recurrence)}`, body: n.title, href: `/app/negotiations/${n.id}` });
  }
  if (waitingOn.includes("business") && n.businessId) {
    const b = await ctx.store.get("businesses", n.businessId);
    if (b?.ownerId) await notify(ctx, b.ownerId, { kind: "negotiation", title: `Approve final terms: ${formatMoney(opts.priceCents)}`, body: n.title, href: `/biz/inbox/${n.id}` });
  }
  return proposed;
}

/** The customer or the business explicitly approves the final terms. */
export async function approveFinalTerms(ctx: Ctx, actor: Actor, negotiationId: string, confirmed: boolean): Promise<Negotiation> {
  if (!confirmed) throw new ValidationError("Tick the box to confirm you approve these final terms");
  const n = await ctx.store.get("negotiations", negotiationId);
  if (!n || !canViewNegotiation(actor, n)) throw new NotFoundError("Negotiation");
  if (n.state !== "final_approval" || !n.finalTerms) throw new ValidationError("There are no final terms awaiting approval");
  const now = ctx.now().toISOString();
  let terms: FinalTerms;
  if (actor.role === "customer" && n.customerId === actor.userId) {
    if (n.finalTerms.customerApprovedAt) throw new ValidationError("You've already approved these terms");
    terms = { ...n.finalTerms, customerApprovedAt: now, customerApprovedBy: actor.userId };
  } else if (actor.role === "business" && n.businessId === actor.businessId) {
    await assertBusinessCanAct(ctx, n.businessId!);
    if (n.finalTerms.businessApproval !== "required" || n.finalTerms.businessApprovedAt) throw new ValidationError("Business approval isn't needed");
    terms = { ...n.finalTerms, businessApprovedAt: now, businessApprovedBy: actor.userId };
  } else {
    throw new ForbiddenError();
  }
  const who = actor.role === "customer" ? "Customer" : n.counterpartyName;
  const approved = await applyNegotiation(ctx, n, null, { finalTerms: terms }, [msg(ctx, { from: actor.role === "customer" ? "customer" : "business", kind: "decision", amountCents: terms.priceCents, body: `${who} approved the final terms: ${formatMoney(terms.priceCents)}${per(n.recurrence)}.` })]);
  await audit(ctx, actor, "terms.approved", "negotiation", n.id, { priceCents: terms.priceCents });
  if (termsFullyApproved(terms)) return finaliseAgreement(ctx, approved);
  return approved;
}

/**
 * Atomically: negotiation → agreed, transaction (pending verification), "saving recorded" ledger
 * entry, accepted offer, declined competing offers, awarded request. All or nothing; the version
 * guard stops a concurrent change from slipping in between.
 */
export async function finaliseAgreement(ctx: Ctx, n: Negotiation): Promise<Negotiation> {
  if (n.state !== "final_approval" || !n.finalTerms || !termsFullyApproved(n.finalTerms)) throw new ValidationError("Final terms are not approved by both parties");
  const price = n.finalTerms.priceCents;
  const s = calculateSavings(n.baselineCents, price, n.recurrence);
  const customer = await ctx.store.get("users", n.customerId);
  const now = ctx.now().toISOString();
  const tx: Transaction = {
    id: newId(), customerId: n.customerId, businessId: n.businessId, categoryId: n.categoryId, description: n.title,
    requestId: n.requestId, offerId: n.offerId, negotiationId: n.id, groupId: n.groupId, baselineCents: n.baselineCents, finalCents: price,
    recurrence: n.recurrence, periodSavingsCents: s.periodSavingsCents, annualSavingsCents: s.annualSavingsCents,
    status: "pending_verification", feeCents: 0, feeStatus: s.isSaving ? "pending" : "not_applicable", qualifiesForFee: false,
    currency: ctx.fees.currency, jurisdiction: customer?.jurisdiction ?? "AU", simulated: n.simulated, createdAt: now,
  };
  const next = nextNegotiation(ctx, n, "APPROVE_TERMS", { agreedCents: price }, [msg(ctx, { from: "system", kind: "decision", amountCents: price, body: "Both parties approved the final terms. Confirm the final invoice once the work is done to verify your saving." })]);
  const w = negotiationWrite(n, next);
  const ops: BatchOp[] = [
    w.op,
    ins("transactions", tx),
    ins("ledger", ledgerRow(ctx, { transactionId: tx.id, userId: n.customerId, type: "saving_recorded", amountCents: s.periodSavingsCents, idempotencyKey: `saving:${tx.id}`, simulated: n.simulated || !!customer?.isDemo, note: "Unverified — pending customer confirmation" })),
  ];
  if (n.offerId) ops.push(upd("offers", n.offerId, { status: "accepted", priceCents: price, updatedAt: now }));
  if (n.requestId) {
    ops.push(upd("requests", n.requestId, { status: "awarded" }));
    for (const o of await ctx.store.list("offers", { requestId: n.requestId })) {
      if (o.id !== n.offerId && ["submitted", "countered"].includes(o.status)) ops.push(upd("offers", o.id, { status: "declined", updatedAt: now }));
    }
  }
  const ok = await ctx.store.atomic([w.guard], ops);
  if (!ok) {
    const latest = await ctx.store.get("negotiations", n.id);
    if (latest && (latest.state === "agreed" || latest.state === "completed")) return latest;
    throw new ConflictError();
  }
  await audit(ctx, "system", "transaction.recorded", "transaction", tx.id, { negotiationId: n.id, periodSavingsCents: s.periodSavingsCents });
  return next;
}

/** Accept a marketplace offer as-is. The business must still approve the final terms (unless simulated). */
export async function acceptOfferDirectly(ctx: Ctx, actor: Actor, offerId: string, confirmed: boolean): Promise<Negotiation> {
  requireRole(actor, "customer");
  if (!confirmed) throw new ValidationError("Please confirm you want to accept this offer");
  const offer = await ctx.store.get("offers", offerId);
  if (!offer) throw new NotFoundError("Offer");
  const req = await ctx.store.get("requests", offer.requestId);
  if (!req || req.customerId !== actor.userId) throw new ForbiddenError();
  if (!["submitted", "countered"].includes(offer.status)) throw new ValidationError("This offer can no longer be accepted");
  if (["awarded", "completed", "cancelled"].includes(req.status)) throw new ValidationError("This request is already closed");
  const existing = (await ctx.store.list("negotiations", { offerId })).find((x) => !["declined", "cancelled", "expired"].includes(x.state));
  if (existing) throw new ValidationError("You're already negotiating this offer — accept it from the negotiation");
  const business = (await ctx.store.get("businesses", offer.businessId))!;
  const now = ctx.now().toISOString();
  const n: Negotiation = {
    id: newId(), customerId: actor.userId, categoryId: req.categoryId, title: `${req.title} — ${business.name}`, requestId: req.id, offerId, businessId: business.id,
    counterpartyName: business.name, mode: "approval", state: "open", baselineCents: req.baselineCents, targetCents: offer.priceCents,
    currentOfferCents: offer.priceCents, recurrence: req.recurrence, simulated: offer.isSimulated, version: 0, createdAt: now, updatedAt: now, messages: [],
  };
  await ctx.store.insert("negotiations", n);
  await audit(ctx, actor, "offer.accepted", "offer", offerId, { priceCents: offer.priceCents });
  return proposeFinalTerms(ctx, n, {
    by: "customer", userId: actor.userId, priceCents: offer.priceCents,
    messages: [msg(ctx, { from: "customer", kind: "decision", amountCents: offer.priceCents, body: `You accepted the offer at ${formatMoney(offer.priceCents)}.` })],
  });
}

/**
 * Customer confirms the deal happened at the final invoiced amount. Savings are recalculated from
 * the confirmed amount, the fee is assessed, and everything is written atomically. A second
 * (concurrent or retried) verification fails cleanly and can never assess a second fee.
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
  const customer = await ctx.store.get("users", tx.customerId);
  const demo = tx.simulated || !!customer?.isDemo;
  const s = calculateSavings(tx.baselineCents, input.finalCents, tx.recurrence);
  const now = ctx.now().toISOString();
  const verified: Transaction = {
    ...tx, finalCents: input.finalCents, periodSavingsCents: s.periodSavingsCents, annualSavingsCents: s.annualSavingsCents,
    status: "verified", verificationMethod: input.method, evidenceDocumentId: input.evidenceDocumentId, verifiedAt: now, verifiedBy: actor.userId,
  };
  const fee = assessFee(verified, ctx.fees);
  Object.assign(verified, { feeCents: fee.feeCents, feeStatus: fee.feeStatus, qualifiesForFee: fee.qualifies, feeReason: fee.reason });

  const { id: _id, ...txPatch } = verified;
  const ops: BatchOp[] = [
    upd("transactions", tx.id, txPatch),
    ins("ledger", ledgerRow(ctx, { transactionId: tx.id, userId: tx.customerId, type: "saving_verified", amountCents: s.periodSavingsCents, idempotencyKey: `verified:${tx.id}`, simulated: demo })),
    ins("ledger", ledgerRow(ctx, fee.qualifies
      ? { transactionId: tx.id, userId: tx.customerId, type: "fee_assessed", amountCents: fee.feeCents, idempotencyKey: `fee:${tx.id}`, simulated: demo, note: `${fee.reason}. Assessed only — payments are not enabled, nothing was charged.` }
      : { transactionId: tx.id, userId: tx.customerId, type: "fee_waived", amountCents: 0, idempotencyKey: `fee:${tx.id}`, simulated: demo, note: fee.reason })),
  ];
  const guards = [{ table: "transactions" as const, id: tx.id, field: "status", equals: "pending_verification" }];
  if (tx.negotiationId) {
    const n = await ctx.store.get("negotiations", tx.negotiationId);
    if (n && n.state === "agreed") {
      const w = negotiationWrite(n, nextNegotiation(ctx, n, "COMPLETE", {}));
      ops.push(w.op);
    }
  }
  if (tx.requestId) ops.push(upd("requests", tx.requestId, { status: "completed" }));
  const ok = await ctx.store.atomic(guards, ops);
  if (!ok) throw new ValidationError("This transaction has already been resolved");
  await audit(ctx, actor, "transaction.verified", "transaction", tx.id, { method: input.method, finalCents: input.finalCents, feeCents: fee.feeCents, qualifies: fee.qualifies });
  if (tx.businessId) {
    const b = await ctx.store.get("businesses", tx.businessId);
    if (b?.ownerId && !b.isSimulated) await notify(ctx, b.ownerId, { kind: "offer", title: "Job verified complete", body: tx.description, href: "/biz/transactions" });
  }
  return verified;
}

/** The deal fell through. No saving is counted and no fee is assessed. */
export async function cancelTransaction(ctx: Ctx, actor: Actor, txId: string, reason: string): Promise<Transaction> {
  const tx = await ctx.store.get("transactions", txId);
  if (!tx) throw new NotFoundError("Transaction");
  if (actor.role !== "admin" && tx.customerId !== actor.userId) throw new ForbiddenError();
  if (tx.status !== "pending_verification") throw new ValidationError("Only pending transactions can be cancelled");
  const ops: BatchOp[] = [upd("transactions", tx.id, { status: "cancelled", feeStatus: "not_applicable", feeCents: 0 })];
  if (tx.negotiationId) {
    const n = await ctx.store.get("negotiations", tx.negotiationId);
    if (n && n.state === "agreed") ops.push(negotiationWrite(n, nextNegotiation(ctx, n, "CANCEL", {})).op);
  }
  const ok = await ctx.store.atomic([{ table: "transactions", id: tx.id, field: "status", equals: "pending_verification" }], ops);
  if (!ok) throw new ValidationError("Only pending transactions can be cancelled");
  await audit(ctx, actor, "transaction.cancelled", "transaction", tx.id, { reason: reason.slice(0, 300) });
  return { ...tx, status: "cancelled", feeStatus: "not_applicable", feeCents: 0 };
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

