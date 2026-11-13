import { getCategory, isCategory } from "../domain/categories";
import { formatMoney, type Cents } from "../domain/money";
import {
  ACTIVE_STATES, checkAutopilot, recommendResponse, suggestTarget, transition, type NegotiationEvent, type Recommendation,
} from "../domain/negotiation";
import { canViewNegotiation, ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import type { Actor, Negotiation, NegotiationMessage, PermissionMode, Recurrence } from "../domain/types";
import { audit, newId, notify, type Ctx } from "./context";
import { recordAgreement } from "./transactions";

const round100 = (c: number) => Math.round(c / 100) * 100;

async function load(ctx: Ctx, actor: Actor, id: string): Promise<Negotiation> {
  const n = await ctx.store.get("negotiations", id);
  if (!n) throw new NotFoundError("Negotiation");
  if (!canViewNegotiation(actor, n)) throw new ForbiddenError();
  return n;
}

function msg(ctx: Ctx, m: Omit<NegotiationMessage, "id" | "at">): NegotiationMessage {
  return { id: newId(), at: ctx.now().toISOString(), ...m };
}

async function apply(ctx: Ctx, n: Negotiation, event: NegotiationEvent, patch: Partial<Negotiation>, messages: NegotiationMessage[] = []): Promise<Negotiation> {
  const state = transition(n.state, event);
  return ctx.store.update("negotiations", n.id, { ...patch, state, messages: [...n.messages, ...messages], updatedAt: ctx.now().toISOString() });
}

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
    benchmarkLow = doc.analysis?.benchmarkLowCents;
  }
  benchmarkLow ??= round100(input.baselineCents * category.simulatedBenchmark.low);
  const target = input.targetCents && input.targetCents > 0 ? Math.min(input.targetCents, input.baselineCents) : suggestTarget(input.baselineCents, benchmarkLow);
  const now = ctx.now().toISOString();
  const n: Negotiation = {
    id: newId(), customerId: actor.userId, categoryId: input.categoryId, title: input.title.trim().slice(0, 140) || `${category.name} — ${counterparty}`,
    counterpartyName: `${counterparty} (simulated)`, mode: input.mode ?? user.permissionMode, state: "open", baselineCents: input.baselineCents,
    targetCents: target, currentOfferCents: input.baselineCents, recurrence: input.recurrence, simulated: true, createdAt: now, updatedAt: now,
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
    currentOfferCents: offer.priceCents, recurrence: req.recurrence, simulated: offer.isSimulated, createdAt: now, updatedAt: now,
    messages: [msg(ctx, { from: "ai", kind: "analysis", body: `${business.name} offered ${formatMoney(offer.priceCents)} against your ${formatMoney(req.baselineCents)} quote. Suggested target: ${formatMoney(target)}.` })],
  };
  await ctx.store.insert("negotiations", n);
  await ctx.store.update("requests", req.id, { status: "negotiating" });
  await audit(ctx, actor, "negotiation.started", "negotiation", n.id, { offerId, mode: n.mode });
  return n;
}

const per = (r: Recurrence) => (r === "monthly" ? "/month" : r === "annual" ? "/year" : r === "weekly" ? "/week" : r === "quarterly" ? "/quarter" : "");

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
      ? await ctx.store.update("negotiations", n.id, { messages: [...n.messages, msg(ctx, { from: "ai", kind: "escalation", body: rec.reason })] })
      : await apply(ctx, n, "ESCALATE", {}, [msg(ctx, { from: "ai", kind: "escalation", body: rec.reason, amountCents: rec.priceCents })]);
    await audit(ctx, actor, "negotiation.escalated", "negotiation", n.id, { reason: rec.reason });
    return { negotiation: updated, recommendation: rec };
  }

  const intent = rec.action === "accept" ? "accept" : opening ? "opening" : "counter";
  const body = await ctx.ai.draftNegotiationMessage({ negotiation: n, category, intent, priceCents: rec.priceCents, customerName: user.name.split(" ")[0] });

  if (n.mode === "advisory") {
    const updated = await ctx.store.update("negotiations", n.id, {
      messages: [...n.messages, msg(ctx, { from: "ai", kind: "note", amountCents: rec.priceCents, body: `Recommendation: ${rec.action} at ${formatMoney(rec.priceCents)}. ${rec.reason}\n\nSuggested wording you can send yourself:\n${body}` })],
      updatedAt: ctx.now().toISOString(),
    });
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
    await ctx.store.update("negotiations", n.id, { messages });
    return acceptCurrentOffer(ctx, actor, n.id, true);
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
  return ctx.store.update("negotiations", n.id, { messages, state: hasCounter ? "counter_received" : "open", updatedAt: ctx.now().toISOString() });
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
    const agreed = await apply(ctx, n, "ACCEPT", { agreedCents: askCents, currentOfferCents: askCents }, [
      msg(ctx, { from: "business", kind: "decision", simulated: true, amountCents: askCents, body: `(Simulated reply) We can do ${formatMoney(askCents)}${per(n.recurrence)}. We've applied it to your account from the next billing period.` }),
    ]);
    await audit(ctx, "system", "negotiation.simulated_accept", "negotiation", n.id, { askCents });
    return recordAgreement(ctx, agreed);
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
  const agreed = await apply(ctx, n, "ACCEPT", { agreedCents }, [msg(ctx, { from: via === "autopilot" ? "ai" : "customer", kind: "decision", amountCents: agreedCents, body: `${via === "autopilot" ? "Limited Autopilot accepted" : "You accepted"} ${formatMoney(agreedCents)}${per(n.recurrence)}.` })]);
  await audit(ctx, actor, "negotiation.accepted", "negotiation", n.id, { agreedCents, via });
  if (n.businessId && !n.simulated) {
    const b = await ctx.store.get("businesses", n.businessId);
    if (b?.ownerId) await notify(ctx, b.ownerId, { kind: "negotiation", title: `Accepted: ${n.title}`, body: `Customer accepted ${formatMoney(agreedCents)}.`, href: `/biz/inbox/${n.id}` });
  }
  return recordAgreement(ctx, agreed);
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
  const updated = await ctx.store.update("negotiations", n.id, { mode, updatedAt: ctx.now().toISOString() });
  await audit(ctx, actor, "negotiation.mode_changed", "negotiation", n.id, { from: n.mode, to: mode });
  return updated;
}

export async function setTarget(ctx: Ctx, actor: Actor, id: string, targetCents: Cents): Promise<Negotiation> {
  const n = await load(ctx, actor, id);
  if (actor.userId !== n.customerId) throw new ForbiddenError();
  if (!Number.isInteger(targetCents) || targetCents <= 0 || targetCents > n.baselineCents) throw new ValidationError("Target must be positive and no higher than what you pay now");
  return ctx.store.update("negotiations", n.id, { targetCents, updatedAt: ctx.now().toISOString() });
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

export async function getBusinessNegotiation(ctx: Ctx, actor: Actor, id: string) {
  requireRole(actor, "business");
  return redactForBusiness(await load(ctx, actor, id));
}

export async function draftBusinessCounter(ctx: Ctx, actor: Actor, id: string, minimumCents: Cents) {
  requireRole(actor, "business");
  const n = await load(ctx, actor, id);
  const b = (await ctx.store.get("businesses", n.businessId!))!;
  const lastAsk = [...n.messages].reverse().find((m) => m.kind === "sent" && m.amountCents !== undefined)?.amountCents ?? n.currentOfferCents;
  const draft = await ctx.ai.draftBusinessCounter({ negotiation: redactForBusiness(n), business: b, requestedCents: lastAsk, minimumCents });
  await audit(ctx, actor, "negotiation.business_ai_draft", "negotiation", n.id, { provider: ctx.ai.name });
  return { ...draft, lastAsk };
}

export async function businessRespond(
  ctx: Ctx, actor: Actor, id: string,
  input: { action: "counter" | "accept" | "decline"; priceCents?: Cents; message: string },
): Promise<Negotiation> {
  requireRole(actor, "business");
  const n = await load(ctx, actor, id);
  if (n.state !== "awaiting_counterparty") throw new ValidationError("Waiting on the customer — nothing to respond to");
  const lastAsk = [...n.messages].reverse().find((m) => m.kind === "sent" && m.amountCents !== undefined)?.amountCents;
  const body = input.message.trim().slice(0, 2000);
  let updated: Negotiation;
  if (input.action === "accept") {
    if (lastAsk === undefined) throw new ValidationError("No customer price to accept");
    updated = await apply(ctx, n, "ACCEPT", { agreedCents: lastAsk, currentOfferCents: lastAsk }, [msg(ctx, { from: "business", kind: "decision", amountCents: lastAsk, body: body || `Accepted ${formatMoney(lastAsk)}.` })]);
    if (n.offerId) await ctx.store.update("offers", n.offerId, { priceCents: lastAsk, updatedAt: ctx.now().toISOString() });
    await audit(ctx, actor, "negotiation.business_accepted", "negotiation", n.id, { agreedCents: lastAsk });
    await notify(ctx, n.customerId, { kind: "negotiation", title: `${n.counterpartyName} accepted ${formatMoney(lastAsk)}`, body: "Confirm the final invoice to record your verified saving.", href: `/app/negotiations/${n.id}` });
    return redactForBusiness(await recordAgreement(ctx, updated));
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
  updated = await apply(ctx, n, "RECEIVE_COUNTER", { currentOfferCents: price }, [msg(ctx, { from: "business", kind: "counter", amountCents: price, body: body || `We can offer ${formatMoney(price)}.` })]);
  if (n.offerId) await ctx.store.update("offers", n.offerId, { priceCents: price, status: "countered", updatedAt: ctx.now().toISOString() });
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
  return { negotiation: n, transaction: tx, recommendation: ACTIVE_STATES.includes(n.state) && n.state !== "agreed" ? recommendResponse(n) : undefined };
}
