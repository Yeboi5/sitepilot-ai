import type { Decision } from "./types";

/**
 * Swipe deck state (pure, unit-tested). The UI (pointer, keyboard, buttons) only dispatches
 * actions; persistence (browser storage for guests, the database for users) is a side effect.
 */
export type DeckState = {
  queue: string[]; // listing ids still to decide, top card first
  history: { id: string; decision: Decision }[]; // most recent last, for undo
};

export type DeckAction = { type: "decide"; decision: Decision } | { type: "undo" } | { type: "reset"; ids: string[] };

export function initDeck(ids: string[], decided: ReadonlySet<string> = new Set()): DeckState {
  return { queue: ids.filter((id) => !decided.has(id)), history: [] };
}

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "decide": {
      const [top, ...rest] = state.queue;
      if (!top) return state;
      return { queue: rest, history: [...state.history, { id: top, decision: action.decision }] };
    }
    case "undo": {
      const last = state.history.at(-1);
      if (!last) return state;
      return { queue: [last.id, ...state.queue], history: state.history.slice(0, -1) };
    }
    case "reset":
      return initDeck(action.ids);
  }
}

/** Horizontal drag (px) needed to count as a swipe, and the matching decision. */
export const SWIPE_THRESHOLD = 110;
export function decisionForDrag(dx: number): Decision | null {
  if (dx >= SWIPE_THRESHOLD) return "save";
  if (dx <= -SWIPE_THRESHOLD) return "pass";
  return null;
}
