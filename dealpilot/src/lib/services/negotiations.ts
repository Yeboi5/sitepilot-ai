import { getCategory, isCategory } from "../domain/categories";
import { formatMoney, type Cents } from "../domain/money";
import {
  ACTIVE_STATES, checkAutopilot, recommendResponse, suggestTarget, type NegotiationEvent, type Recommendation,
} from "../domain/negotiation";
import { canViewNegotiation, ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import type { Actor, Negotiation, NegotiationMessage, PermissionMode, Recurrence } from "../domain/types";
import { upd } from "../store/types";
import { aiFor, audit, newId, notify, type Ctx } from "./context";
import { enforceRateLimit } from "./rate-limit";
import { applyNegotiation, msg, per } from "./negotiation-store";
import { proposeFinalTerms } from "./transactions";

const round100 = (c: number) => Math.round(c / 100) * 100;

async function load(ctx: Ctx, actor: Actor, id: string): Promise<Negotiation> {
  const n = await ctx.store.get("negotiations", id);
  if (!n) throw new NotFoundError("Negotiation");
  if (!canViewNegotiation(actor, n)) throw new ForbiddenError();
  return n;
}

const apply = (ctx: Ctx, n: Negotiation, event: NegotiationEvent | null, patch: Partial<Negotiation>, messages: NegotiationMessage[] = []) =>
  applyNegotiation(ctx, n, event, patch, messages);

// ─── Start ───────────────────────────────────────────────────────────────────

export interface StartNegotiationInput {
  categoryId: string;
  title: string;
  counterpartyName: string;
  baselineCents: Cents;
  recurrence: Recurrence;
  targetCents?: Cents;
  mode?: PermissionMode;
  documentId?: string;
}

/** Negotiate an existing bill/contract with an external provider (simulated until an authorised integration exists). */
export async function startExternalNegotiation(ctx: Ctx, actor: Actor, input: StartNegotiationInput): Promise<Negotiation> {
  requireRole(actor, "customer");
  if (!isCategory(input.categoryId)) throw new ValidationError("Choose a category");
  if (!Number.isInteger(input.baselineCents) || input.baselineCents <= 0) throw new ValidationError("Enter what you pay now");
  const counterparty = input.counterpartyName.trim().slice(0, 100);
  if (!counterparty) throw new ValidationError("Who is the provider?");
  const user = (await ctx.store.get("users", actor.userId))!;
  const category = getCategory(input.categoryId);
  let benchmarkLow: Cents | undefined;
  if (input.documentId) {
    const doc = await ctx.store.get("documents", input.documentId);
    if (!doc || doc.ownerId !== actor.userId) throw new ForbiddenError("That document isn't yours");
    if (!doc.confirmedAt) throw new ValidationError("Review and confirm the details extracted from your document first");
    benchmarkLow = doc.analysis?.benchmarkLowCents;
  }
  benchmarkLow ??= round100(input.baselineCents * category.simulatedBenchmark.low);
  const target = input.targetCents && input.targetCents > 0 ? Math.min(input.targetCents, input.baselineCents) : suggestTarget(input.baselineCents, benchmarkLow);
  const now = ctx.now().toISOString();
  const n: Negotiation = {
    id: newId(), customerId: actor.userId, categoryId: input.categoryId, title: input.title.trim().slice(0, 140) || `${category.name} — ${counterparty}`,
    counterpartyName: `${counterparty} (simulated)`, mode: input.mode ?? user.permissionMode, state: "open", baselineCents: input.baselineCents,
    targetCents: target, currentOfferCents: input.baselineCents, recurrence: input.recurrence, simulated: true, version: 0, createdAt: now, updatedAt: now,
    messages: [msg(ctx, { from: "ai", kind: "analysis", simulated: true, body: `You pay ${formatMoney(input.baselineCents)}${per(input.recurrence)}. Simulated market range suggests a target of ${formatMoney(target)}${per(input.recurrence)}. Levers: ${category.negotiationLevers.join(", ")}.` })],
  };
  await ctx.store.insert("negotiations", n);
  await audit(ctx, actor, "negotiation.started", "negotiation", n.id, { external: true, mode: n.mode });
  return n;
}

/** Negotiate an offer received on the marketplace. */
export async function startOfferNegotiation(ctx: Ctx, actor: Actor, offerId: string, targetCents?: Cents): Promise<Negotiation> {
  requireRole(actor, "customer");
  const offer = await ctx.store.get("offers", offerId);
  if (!offer) throw new NotFoundError("Offer");
  const req = await ctx.store.get("requests", offer.requestId);
  if (!req || req.customerId !== actor.userId) throw new ForbiddenError();
  const existing = (await ctx.store.list("negotiations", { offerId })).find((n) => ACTIVE_STATES.includes(n.state));
  if (existing) return existing;
  const business = (await ctx.store.get("businesses", offer.businessId))!;
  const user = (await ctx.store.get("users", actor.userId))!;
  const doc = req.documentId ? await ctx.store.get("documents", req.documentId) : undefined;
  const target = targetCents ?? Math.min(suggestTarget(req.baselineCents, doc?.analysis?.benchmarkLowCents), offer.priceCents);
  const now = ctx.now().toISOString();
  const n: Negotiation = {
    id: newId(), customerId: actor.userId, categoryId: req.categoryId, title: `${req.title} — ${business.name}`, requestId: req.id, offerId, businessId: business.id,
    counterpartyName: business.name, mode: user.permissionMode, state: "open", baselineCents: req.baselineCents, targetCents: target,
    currentOfferCents: offer.priceCents, recurrence: req.recurrence, simulated: offer.isSimulated, version: 0, createdAt: now, updatedAt: now,
    messages: [msg(ctx, { from: "ai", kind: "analysis", body: `${business.name} offered ${formatMoney(offer.priceCents)} against your ${formatMoney(req.baselineCents)} quote. Suggested target: ${formatMoney(target)}.` })],
  };
  await ctx.store.atomic([], [{ op: "insert", table: "negotiations", row: n as unknown as Record<string, unknown> }, upd("requests", req.id, { status: "negotiating" })]);
  await audit(ctx, actor, "negotiation.started", "negotiation", n.id, { offerId, mode: n.mode });
  return n;
}


// ─── AI next step (respects permission mode) ────────────────────────────────

export async function prepareNextAction(ctx: Ctx, actor: Actor, id: string): Promise<{ negotiation: Negotiation; recommendation: Recommendation }> {
  requireRole(actor, "customer");
  const n = await load(ctx, actor, id);
  if (!["open", "counter_received", "escalated"].includes(n.state)) throw new ValidationError("Nothing to prepare right now");
  const user = (await ctx.store.get("users", actor.userId))!;
  const category = getCategory(n.categoryId);
  const opening = !n.messages.some((m) => m.kind === "sent");
  const rec = opening && n.targetCents < n.currentOfferCents
    ? ({ action: "counter", priceCents: n.targetCents, reason: "Open with your target price." } as Recommendation)
    : recommendResponse(n);

  if (rec.action === "escalate") {
    const updated = n.state === "escalated"
      ? await apply(ctx, n, null, {}, [msg(ctx, { from: "ai", kind: "escalation", body: rec.reason })])
      : await apply(ctx, n, "ESCALATE", {}, [msg(ctx, { from: "ai", kind: "escalation", body: rec.reason, amountCents: rec.priceCents })]);
    await audit(ctx, actor, "negotiation.escalated", "negotiation", n.id, { reason: rec.reason });
    return { negotiation: updated, recommendation: rec };
  }

  const intent = rec.action === "accept" ? "accept" : opening ? "opening" : "counter";
  await enforceRateLimit(ctx, "aiCall", `user:${actor.userId}`);
  const body = await (await aiFor(ctx, actor.userId)).draftNegotiationMessage({ negotiation: n, category, intent, priceCents: rec.priceCents, customerName: user.name.split(" ")[0] });

  if (n.mode === "advisory") {
    const updated = await apply(ctx, n, null, {}, [msg(ctx, { from: "ai", kind: "note", amountCents: rec.priceCents, body: `Recommendation: ${rec.action} at ${formatMoney(rec.priceCents)}. ${rec.reason}\n\nSuggested wording you can send yourself:\n${body}` })]);
    await audit(ctx, actor, "negotiation.advised", "negotiation", n.id, { action: rec.action });
    return { negotiation: updated, recommendation: rec };
  }

  if (n.mode === "autopilot") {
    const check = checkAutopilot(n, rec.action === "accept" ? "accept" : "send", rec.priceCents, user.autopilotLimitCents);
    if (check.allowed) {
      await audit(ctx, actor, "autopilot.acted", "negotiation", n.id, { action: rec.action, priceCents: rec.priceCents, limitCents: user.autopilotLimitCents });
      if (rec.action === "accept") return { negotiation: await acceptCurrentOffer(ctx, actor, n.id, true, "autopilot"), recommendation: rec };
      const sent = await apply(ctx, n, "SEND", {}, [msg(ctx, { from: "ai", kind: "sent", body: `${body}\n\n(Sent by Limited Autopilot within your ${formatMoney(user.autopilotLimitCents)} limit.)`, amountCents: rec.priceCents, simulated: n.simulated })]);
      return { negotiation: await afterSend(ctx, sent, rec.priceCents), recommendation: rec };
    }
    // Outside autopilot limits → fall through to approval behaviour, and say why.
    rec.reason = `${rec.reason} Autopilot paused: ${check.reason}.`;
  }

  // Approval mode: prepare a draft that requires explicit confirmation.
  const event: NegotiationEvent = "DRAFT_ACTION";
  const pending = n.messages.map((m) => (m.pendingApproval ? { ...m, pendingApproval: false, body: `${m.body}\n\n(Superseded draft)` } : m));
  const updated = await apply(ctx, { ...n, messages: pending }, event, {}, [
    msg(ctx, { from: "ai", kind: "draft", pendingApproval: true, amountCents: rec.priceCents, simulated: n.simulated, body }),
  ]);
  await audit(ctx, actor, "negotiation.draft_prepared", "negotiation", n.id, { action: rec.action, priceCents: rec.priceCents });
  return { negotiation: updated, recommendation: rec };
}

/** Customer explicitly approves the pending AI draft. */
export async function approveDraft(ctx: Ctx, actor: Actor, id: string, messageId: string, editedBody?: string): Promise<Negotiation> {
  requireRole(actor, "customer");
  const n = await load(ctx, actor, id);
  if (n.state !== "awaiting_approval") throw new ValidationError("There is no draft awaiting approval");
  const draft = n.messages.find((m) => m.id === messageId && m.pendingApproval);
  if (!draft || draft.amountCents === undefined) throw new ValidationError("Draft not found");
  const now = ctx.now().toISOString();
  const body = (editedBody?.trim() || draft.body).slice(0, 2000);
  // Asking for the price already on the table is an acceptance.
  const isAccept = draft.amountCents >= n.currentOfferCents;
  const messages = n.messages.map((m) => (m.id === messageId ? { ...m, pendingApproval: false, approvedAt: now } : m));
  await audit(ctx, actor, "negotiation.draft_approved", "negotiation", n.id, { amountCents: draft.amountCents, edited: !!editedBody && editedBody !== draft.body });
  if (isAccept) {
    const withApproval = await apply(ctx, n, null, { messages });
    return acceptCurrentOffer(ctx, actor, withApproval.id, true);
  }
  const sent = await apply(ctx, { ...n, messages }, "SEND", {}, [msg(ctx, { from: "customer", kind: "sent", body, amountCents: draft.amountCents, simulated: n.simulated })]);
  return afterSend(ctx, sent, draft.amountCents);
}

export async function discardDraft(ctx: Ctx, actor: Actor, id: string): Promise<Negotiation> {
  const n = await load(ctx, actor, id);
  if (n.state !== "awaiting_approval") throw new ValidationError("No draft to discard");
  const messages = n.messages.map((m) => (m.pendingApproval ? { ...m, pendingApproval: false, body: `${m.body}\n\n(Discarded by you)` } : m));
  const hasCounter = messages.some((m) => m.kind === "counter");
  // Return to the state where the customer can decide again.
  return apply(ctx, n, null, { messages, state: hasCounter ? "counter_received" : "open" });
}

/** After a message is sent: notify a real business, or let the simulated counterparty respond. */
async function afterSend(ctx: Ctx, n: Negotiation, askCents: Cents): Promise<Negotiation> {
  if (!n.simulated && n.businessId) {
    const b = await ctx.store.get("businesses", n.businessId);
    if (b?.ownerId) await notify(ctx, b.ownerId, { kind: "negotiation", title: `Counteroffer request: ${n.title}`, body: `Customer asked for ${formatMoney(askCents)}.`, href: `/biz/inbox/${n.id}` });
    return n;
  }
  return simulateCounterparty(ctx, n, askCents);
}

/**
 * SIMULATED counterparty. Deterministic: has a hidden floor inside the
 * simulated benchmark range; accepts asks at/above it, otherwise splits the
 * difference. Never used for real businesses.
 */
export async function simulateCounterparty(ctx: Ctx, n: Negotiation, askCents: Cents): Promise<Negotiation> {
  if (!n.simulated) throw new ValidationError("Real counterparties respond themselves");
  const b = getCategory(n.categoryId).simulatedBenchmark;
  const floor = round100(n.baselineCents * (b.low + (b.high - b.low) * 0.4));
  if (askCents >= floor) {
    await audit(ctx, "system", "negotiation.simulated_accept", "negotiation", n.id, { askCents });
    // The simulated provider "accepts"; the customer must still explicitly approve the final terms.
    return proposeFinalTerms(ctx, n, {
      by: "business", userId: "simulated", priceCents: askCents, businessApproval: "simulated",
      messages: [msg(ctx, { from: "business", kind: "decision", simulated: true, amountCents: askCents, body: `(Simulated reply) We can do ${formatMoney(askCents)}${per(n.recurrence)}. Please approve the final terms to confirm.` })],
    });
  }
  const counter = Math.min(n.currentOfferCents - 100, Math.max(floor, round100((askCents + n.currentOfferCents) / 2)));
  const updated = await apply(ctx, n, "RECEIVE_COUNTER", { currentOfferCents: counter }, [
    msg(ctx, { from: "business", kind: "counter", simulated: true, amountCents: counter, body: `(Simulated reply) We can't do ${formatMoney(askCents)}, but we can offer ${formatMoney(counter)}${per(n.recurrence)} as a loyalty discount.` }),
  ]);
  await audit(ctx, "system", "negotiation.simulated_counter", "negotiation", n.id, { askCents, counter });
  return updated;
}

/** Advisory/external: customer records a reply they received outside DealPilot. */
export async function recordExternalReply(ctx: Ctx, actor: Actor, id: string, amountCents: Cents, note: string): Promise<Negotiation> {
  requireRole(actor, "customer");
  const n = await load(ctx, actor, id);
  if (n.businessId && !n.simulated) throw new ValidationError("This business replies inside DealPilot");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new ValidationError("Enter the amount they offered");
  return apply(ctx, n, "RECEIVE_COUNTER", { currentOfferCents: amountCents }, [msg(ctx, { from: "customer", kind: "counter", amountCents, body: `Reply recorded by you: ${formatMoney(amountCents)}. ${note.slice(0, 500)}` })]);
}

// ─── Customer decisions ─────────────────────────────────────────────────────

export async function acceptCurrentOffer(ctx: Ctx, actor: Actor, id: string, confirmed: boolean, via: "customer" | "autopilot" = "customer"): Promise<Negotiation> {
  requireRole(actor, "customer");
  if (!confirmed) throw new ValidationError("Please confirm you want to accept");
  const n = await load(ctx, actor, id);
  const agreedCents = n.currentOfferCents;
  await audit(ctx, actor, "negotiation.accepted", "negotiation", n.id, { agreedCents, via });
  // Autopilot can propose acceptance, but final terms always need the customer's own approval.
  return proposeFinalTerms(ctx, n, {
    by: via === "autopilot" ? "autopilot" : "customer", userId: actor.userId, priceCents: agreedCents,
    messages: [msg(ctx, { from: via === "autopilot" ? "ai" : "customer", kind: "decision", amountCents: agreedCents, body: via === "autopilot" ? `Limited Autopilot proposes accepting ${formatMoney(agreedCents)}${per(n.recurrence)}. You must approve the final terms.` : `You accepted ${formatMoney(agreedCents)}${per(n.recurrence)}.` })],
  });
}

export async function walkAway(ctx: Ctx, actor: Actor, id: string): Promise<Negotiation> {
  requireRole(actor, "customer");
  const n = await load(ctx, actor, id);
  const event: NegotiationEvent = n.state === "open" || n.state === "awaiting_approval" ? "CANCEL" : "REJECT";
  const updated = await apply(ctx, n, event, {}, [msg(ctx, { from: "customer", kind: "decision", body: "You ended this negotiation. No fee applies." })]);
  await audit(ctx, actor, "negotiation.ended", "negotiation", n.id, { event });
  return updated;
}

export async function setNegotiationMode(ctx: Ctx, actor: Actor, id: string, mode: PermissionMode): Promise<Negotiation> {
  requireRole(actor, "customer");
  const n = await load(ctx, actor, id);
  const updated = await apply(ctx, n, null, { mode });
  await audit(ctx, actor, "negotiation.mode_changed", "negotiation", n.id, { from: n.mode, to: mode });
  return updated;
}

export async function setTarget(ctx: Ctx, actor: Actor, id: string, targetCents: Cents): Promise<Negotiation> {
  const n = await load(ctx, actor, id);
  if (actor.userId !== n.customerId) throw new ForbiddenError();
  if (!Number.isInteger(targetCents) || targetCents <= 0 || targetCents > n.baselineCents) throw new ValidationError("Target must be positive and no higher than what you pay now");
  return apply(ctx, n, null, { targetCents });
}

// ─── Business side ───────────────────────────────────────────────────────────

export async function listBusinessInbox(ctx: Ctx, actor: Actor) {
  requireRole(actor, "business");
  const ns = await ctx.store.list("negotiations", { businessId: actor.businessId });
  return ns.map(redactForBusiness).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Businesses never see the customer's target price, AI analysis, drafts, or private notes. */
export function redactForBusiness(n: Negotiation): Negotiation {
  return {
    ...n,
    targetCents: 0,
    messages: n.messages.filter((m) => m.kind === "sent" || m.kind === "counter" || (m.kind === "decision" && m.from !== "ai")),
  };
}

export { approveFinalTerms } from "./transactions";

export async function getBusinessNegotiation(ctx: Ctx, actor: Actor, id: string) {
  requireRole(actor, "business");
  return redactForBusiness(await load(ctx, actor, id));
}

export async function draftBusinessCounter(ctx: Ctx, actor: Actor, id: string, minimumCents: Cents) {
  requireRole(actor, "business");
  const n = await load(ctx, actor, id);
  const b = (await ctx.store.get("businesses", n.businessId!))!;
  const lastAsk = [...n.messages].reverse().find((m) => m.kind === "sent" && m.amountCents !== undefined)?.amountCents ?? n.currentOfferCents;
  await enforceRateLimit(ctx, "aiCall", `user:${actor.userId}`);
  const ai = await aiFor(ctx, actor.userId);
  const draft = await ai.draftBusinessCounter({ negotiation: redactForBusiness(n), business: b, requestedCents: lastAsk, minimumCents });
  await audit(ctx, actor, "negotiation.business_ai_draft", "negotiation", n.id, { provider: ai.name });
  return { ...draft, lastAsk };
}

export async function businessRespond(
  ctx: Ctx, actor: Actor, id: string,
  input: { action: "counter" | "accept" | "decline"; priceCents?: Cents; message: string },
): Promise<Negotiation> {
  requireRole(actor, "business");
  const n = await load(ctx, actor, id);
  const biz = await ctx.store.get("businesses", n.businessId!);
  if (biz?.verificationStatus !== "verified") throw new ForbiddenError(biz?.verificationStatus === "suspended" ? "Your business is suspended" : "Your business must be verified to respond");
  if (n.state !== "awaiting_counterparty") throw new ValidationError("Waiting on the customer — nothing to respond to");
  const lastAsk = [...n.messages].reverse().find((m) => m.kind === "sent" && m.amountCents !== undefined)?.amountCents;
  const body = input.message.trim().slice(0, 2000);
  let updated: Negotiation;
  if (input.action === "accept") {
    if (lastAsk === undefined) throw new ValidationError("No customer price to accept");
    await audit(ctx, actor, "negotiation.business_accepted", "negotiation", n.id, { agreedCents: lastAsk });
    // The business's acceptance is its approval of the final terms; the customer must approve too.
    updated = await proposeFinalTerms(ctx, n, {
      by: "business", userId: actor.userId, priceCents: lastAsk,
      messages: [msg(ctx, { from: "business", kind: "decision", amountCents: lastAsk, body: body || `Accepted ${formatMoney(lastAsk)}.` })],
    });
    return redactForBusiness(updated);
  }
  if (input.action === "decline") {
    updated = await apply(ctx, n, "REJECT", {}, [msg(ctx, { from: "business", kind: "decision", body: body || "Declined." })]);
    await audit(ctx, actor, "negotiation.business_declined", "negotiation", n.id);
    await notify(ctx, n.customerId, { kind: "negotiation", title: `${n.counterpartyName} declined`, body: "No fee applies. Compare other offers.", href: `/app/negotiations/${n.id}` });
    return redactForBusiness(updated);
  }
  const price = input.priceCents;
  if (!price || !Number.isInteger(price) || price <= 0) throw new ValidationError("Enter your counteroffer price");
  if (price >= n.currentOfferCents) throw new ValidationError(`A counteroffer must be lower than your current offer of ${formatMoney(n.currentOfferCents)}`);
  if (lastAsk !== undefined && price <= lastAsk) throw new ValidationError("That's at or below the customer's ask — accept it instead");
  updated = await applyNegotiation(ctx, n, "RECEIVE_COUNTER", { currentOfferCents: price }, [msg(ctx, { from: "business", kind: "counter", amountCents: price, body: body || `We can offer ${formatMoney(price)}.` })],
    n.offerId ? [upd("offers", n.offerId, { priceCents: price, status: "countered", updatedAt: ctx.now().toISOString() })] : []);
  await audit(ctx, actor, "negotiation.business_countered", "negotiation", n.id, { priceCents: price });
  await notify(ctx, n.customerId, { kind: "negotiation", title: `Counteroffer: ${formatMoney(price)}`, body: `${n.counterpartyName} responded on "${n.title}".`, href: `/app/negotiations/${n.id}` });
  return redactForBusiness(updated);
}

export async function listCustomerNegotiations(ctx: Ctx, actor: Actor) {
  requireRole(actor, "customer");
  return (await ctx.store.list("negotiations", { customerId: actor.userId })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCustomerNegotiation(ctx: Ctx, actor: Actor, id: string) {
  requireRole(actor, "customer", "admin");
  const n = await load(ctx, actor, id);
  const tx = (await ctx.store.list("transactions", { negotiationId: id }))[0];
  return { negotiation: n, transaction: tx, recommendation: ["open", "counter_received", "escalated"].includes(n.state) ? recommendResponse(n) : undefined };
}
