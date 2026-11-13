import type { Cents } from "./money";
import type { Negotiation, NegotiationState, PermissionMode } from "./types";

/**
 * Negotiation state machine. All negotiations, in every category, move
 * through the same states. Money decisions are deterministic (policy below);
 * the AI only drafts wording.
 */
export type NegotiationEvent =
  | "DRAFT_ACTION" // AI prepared a message that needs customer approval
  | "SEND" // a message was sent to the counterparty (by customer, approved draft, or autopilot)
  | "RECEIVE_COUNTER" // counterparty responded with a price
  | "ESCALATE" // decision needs the customer
  | "ACCEPT" // terms agreed
  | "REJECT" // counterparty or customer declined; negotiation unsuccessful
  | "CANCEL"
  | "EXPIRE"
  | "COMPLETE"; // transaction recorded

const T: Record<NegotiationState, Partial<Record<NegotiationEvent, NegotiationState>>> = {
  open: { DRAFT_ACTION: "awaiting_approval", SEND: "awaiting_counterparty", RECEIVE_COUNTER: "counter_received", ESCALATE: "escalated", ACCEPT: "agreed", CANCEL: "cancelled", EXPIRE: "expired" },
  awaiting_approval: { SEND: "awaiting_counterparty", DRAFT_ACTION: "awaiting_approval", ACCEPT: "agreed", CANCEL: "cancelled", ESCALATE: "escalated", EXPIRE: "expired" },
  awaiting_counterparty: { RECEIVE_COUNTER: "counter_received", ACCEPT: "agreed", REJECT: "declined", CANCEL: "cancelled", EXPIRE: "expired" },
  counter_received: { DRAFT_ACTION: "awaiting_approval", SEND: "awaiting_counterparty", ESCALATE: "escalated", ACCEPT: "agreed", REJECT: "declined", CANCEL: "cancelled", EXPIRE: "expired" },
  escalated: { DRAFT_ACTION: "awaiting_approval", SEND: "awaiting_counterparty", ACCEPT: "agreed", REJECT: "declined", CANCEL: "cancelled", EXPIRE: "expired" },
  agreed: { COMPLETE: "completed", CANCEL: "cancelled" },
  completed: {},
  declined: {},
  cancelled: {},
  expired: {},
};

export const TERMINAL_STATES: NegotiationState[] = ["completed", "declined", "cancelled", "expired"];
export const ACTIVE_STATES: NegotiationState[] = ["open", "awaiting_approval", "awaiting_counterparty", "counter_received", "escalated", "agreed"];

export class InvalidTransitionError extends Error {
  constructor(public from: NegotiationState, public event: NegotiationEvent) {
    super(`Cannot ${event} a negotiation in state "${from}"`);
  }
}

export function canTransition(from: NegotiationState, event: NegotiationEvent): boolean {
  return T[from][event] !== undefined;
}

export function transition(from: NegotiationState, event: NegotiationEvent): NegotiationState {
  const next = T[from][event];
  if (!next) throw new InvalidTransitionError(from, event);
  return next;
}

export const STATE_LABELS: Record<NegotiationState, string> = {
  open: "Open",
  awaiting_approval: "Needs your approval",
  awaiting_counterparty: "Waiting for reply",
  counter_received: "Counteroffer received",
  escalated: "Your decision needed",
  agreed: "Agreed — record & verify",
  completed: "Completed",
  declined: "Unsuccessful",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const MODE_LABELS: Record<PermissionMode, { label: string; description: string }> = {
  advisory: { label: "Advisory", description: "AI recommends actions only. You contact providers yourself." },
  approval: { label: "Approval", description: "AI prepares every message and decision; nothing is sent or accepted without your explicit confirmation." },
  autopilot: { label: "Limited Autopilot", description: "AI may send and accept within your spending limit and target price. Everything is audit-logged. Future feature — simulated counterparties only in this prototype." },
};

// ─── Policy ──────────────────────────────────────────────────────────────────

export type Recommendation =
  | { action: "accept"; reason: string; priceCents: Cents }
  | { action: "counter"; reason: string; priceCents: Cents }
  | { action: "escalate"; reason: string; priceCents?: Cents };

/**
 * Deterministic recommendation for how to respond to the counterparty's
 * current offer. Counter at the midpoint between target and offer, rounded
 * to the dollar, with a maximum of `maxRounds` counters before escalating.
 */
export function recommendResponse(
  n: Pick<Negotiation, "targetCents" | "currentOfferCents" | "messages">,
  maxRounds = 3,
): Recommendation {
  const { targetCents, currentOfferCents } = n;
  if (currentOfferCents <= targetCents) {
    return { action: "accept", priceCents: currentOfferCents, reason: "The offer meets or beats your target price." };
  }
  const counters = n.messages.filter((m) => m.kind === "sent" && m.amountCents !== undefined).length;
  if (counters >= maxRounds) {
    return { action: "escalate", priceCents: currentOfferCents, reason: `After ${counters} rounds the best offer is still above your target. Decide whether to accept it or walk away.` };
  }
  const mid = Math.round((targetCents + currentOfferCents) / 2 / 100) * 100;
  if (mid <= targetCents || mid >= currentOfferCents - 100) {
    return { action: "escalate", priceCents: currentOfferCents, reason: "The remaining gap to your target is small. Decide whether to accept." };
  }
  return { action: "counter", priceCents: mid, reason: "Counter between your target and their offer to keep momentum." };
}

export interface AutopilotCheck {
  allowed: boolean;
  reason: string;
}

/**
 * Limited Autopilot guard. AI may act autonomously only when:
 *  - the customer chose autopilot mode,
 *  - the counterparty is simulated (no authorised real integration exists yet),
 *  - the committed amount is within the customer's per-action spending limit,
 *  - an "accept" is at or below the target price.
 */
export function checkAutopilot(
  n: Pick<Negotiation, "mode" | "simulated" | "targetCents">,
  action: "send" | "accept",
  amountCents: Cents,
  limitCents: Cents,
): AutopilotCheck {
  if (n.mode !== "autopilot") return { allowed: false, reason: "Autopilot is not enabled for this negotiation" };
  if (!n.simulated) return { allowed: false, reason: "Autonomous actions with real providers need an authorised integration (future)" };
  if (limitCents <= 0) return { allowed: false, reason: "No autopilot spending limit set" };
  if (amountCents > limitCents) return { allowed: false, reason: `Amount exceeds your autopilot limit` };
  if (action === "accept" && amountCents > n.targetCents) return { allowed: false, reason: "Autopilot may only accept at or below your target price" };
  return { allowed: true, reason: "Within autopilot limits" };
}

/** Suggested opening target: the low end of the benchmark, never above the baseline. */
export function suggestTarget(baselineCents: Cents, benchmarkLowCents?: Cents): Cents {
  const fallback = Math.round((baselineCents * 0.85) / 100) * 100;
  const t = benchmarkLowCents ?? fallback;
  return Math.min(t, baselineCents);
}
