import type { Decision } from "./types";

/**
 * Guest decisions live only in this browser (no account, nothing sent to the server).
 * Storage may be unavailable (private mode, blocked) or tampered with, so every read is
 * defensive and every write is best-effort.
 */
export const GUEST_STORE_KEY = "sitepilot.discover.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ENTRIES = 500;

export type GuestDecisions = Record<string, Decision>;

export function parseGuestDecisions(raw: string | null): GuestDecisions {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: GuestDecisions = {};
    for (const [id, d] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ENTRIES)) {
      if (UUID.test(id) && (d === "save" || d === "pass")) out[id] = d;
    }
    return out;
  } catch {
    return {};
  }
}

export function readGuestDecisions(): GuestDecisions {
  try {
    return parseGuestDecisions(window.localStorage.getItem(GUEST_STORE_KEY));
  } catch {
    return {};
  }
}

export function writeGuestDecision(id: string, decision: Decision | null) {
  try {
    const all = readGuestDecisions();
    if (decision) all[id] = decision;
    else delete all[id];
    window.localStorage.setItem(GUEST_STORE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: the deck still works for this visit.
  }
}

export function clearGuestDecisions(ids?: string[]) {
  try {
    if (!ids) return window.localStorage.removeItem(GUEST_STORE_KEY);
    const all = readGuestDecisions();
    for (const id of ids) delete all[id];
    window.localStorage.setItem(GUEST_STORE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function savedIds(decisions: GuestDecisions): string[] {
  return Object.entries(decisions)
    .filter(([, d]) => d === "save")
    .map(([id]) => id);
}
