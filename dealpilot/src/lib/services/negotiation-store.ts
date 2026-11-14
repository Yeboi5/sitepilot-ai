import { transition, type NegotiationEvent } from "../domain/negotiation";
import { ConflictError } from "../domain/permissions";
import type { Negotiation, NegotiationMessage } from "../domain/types";
import { upd, type BatchOp } from "../store/types";
import { newId, type Ctx } from "./context";

export function msg(ctx: Ctx, m: Omit<NegotiationMessage, "id" | "at">): NegotiationMessage {
  return { id: newId(), at: ctx.now().toISOString(), ...m };
}

export const per = (r: Negotiation["recurrence"]) => (r === "monthly" ? "/month" : r === "annual" ? "/year" : r === "weekly" ? "/week" : r === "quarterly" ? "/quarter" : "");

/** Builds the next version of a negotiation (validated state transition, appended messages). */
export function nextNegotiation(ctx: Ctx, n: Negotiation, event: NegotiationEvent | null, patch: Partial<Negotiation>, messages: NegotiationMessage[] = []): Negotiation {
  const state = event ? transition(n.state, event) : n.state;
  return { ...n, state, ...patch, messages: [...n.messages, ...messages], version: n.version + 1, updatedAt: ctx.now().toISOString() };
}

/** Batch op + guard pair for writing `next` only if nobody changed `prev` in the meantime. */
export function negotiationWrite(prev: Negotiation, next: Negotiation): { guard: { table: "negotiations"; id: string; field: string; equals: number }; op: BatchOp } {
  const { id: _id, ...patch } = next;
  return { guard: { table: "negotiations", id: prev.id, field: "version", equals: prev.version }, op: upd("negotiations", prev.id, patch) };
}

/**
 * Applies a state change with optimistic concurrency: the write only succeeds if the stored
 * version still matches, so two people acting at once can't silently overwrite each other.
 */
export async function applyNegotiation(ctx: Ctx, n: Negotiation, event: NegotiationEvent | null, patch: Partial<Negotiation>, messages: NegotiationMessage[] = [], extraOps: BatchOp[] = []): Promise<Negotiation> {
  const next = nextNegotiation(ctx, n, event, patch, messages);
  const w = negotiationWrite(n, next);
  const ok = await ctx.store.atomic([w.guard], [w.op, ...extraOps]);
  if (!ok) throw new ConflictError("This negotiation was updated by someone else. Refresh and try again.");
  return next;
}
