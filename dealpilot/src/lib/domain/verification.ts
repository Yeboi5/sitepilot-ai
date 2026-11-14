import type { CategoryDefinition } from "./categories";
import type { Business, BusinessCredential } from "./types";

/**
 * ABN checksum, as published by the Australian Business Register: subtract 1 from the first
 * digit, multiply each digit by its weight, and the sum must be divisible by 89.
 * A valid checksum only means the number is well-formed — not that the business exists or is
 * active. That needs an ABN Lookup (ABR) check.
 */
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export function normaliseAbn(input: string): string {
  return input.replace(/\s+/g, "");
}

export function isValidAbnChecksum(input: string): boolean {
  const abn = normaliseAbn(input);
  if (!/^\d{11}$/.test(abn)) return false;
  const digits = abn.split("").map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((acc, d, i) => acc + d * ABN_WEIGHTS[i], 0);
  return sum % 89 === 0;
}

export type CredentialState = "verified" | "expiring" | "expired" | "submitted" | "rejected" | "missing";

const DAY = 86_400_000;

/** Effective state of the best credential of a kind, taking expiry into account. */
export function credentialState(creds: BusinessCredential[], kind: BusinessCredential["kind"], now = new Date()): { state: CredentialState; credential?: BusinessCredential } {
  const ofKind = creds.filter((c) => c.kind === kind);
  if (!ofKind.length) return { state: "missing" };
  const rank = (c: BusinessCredential) => {
    if (c.status === "verified") {
      if (c.expiresAt && new Date(c.expiresAt) < now) return 2;
      return 4;
    }
    return c.status === "submitted" ? 1 : 0;
  };
  const best = [...ofKind].sort((a, b) => rank(b) - rank(a))[0];
  if (best.status === "rejected") return { state: "rejected", credential: best };
  if (best.status === "submitted") return { state: "submitted", credential: best };
  if (best.expiresAt) {
    const t = new Date(best.expiresAt).getTime();
    if (t < now.getTime()) return { state: "expired", credential: best };
    if (t - now.getTime() < 30 * DAY) return { state: "expiring", credential: best };
  }
  return { state: "verified", credential: best };
}

export const isCredentialValid = (s: CredentialState) => s === "verified" || s === "expiring";

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * Can this business submit genuine offers in this category right now? Requires administrator
 * verification plus any credential the category needs, verified and unexpired.
 */
export function offerEligibility(b: Business, creds: BusinessCredential[], category: CategoryDefinition, now = new Date()): EligibilityResult {
  const reasons: string[] = [];
  if (b.verificationStatus === "suspended") reasons.push(`Business is suspended${b.statusReason ? `: ${b.statusReason}` : ""}`);
  else if (b.verificationStatus !== "verified") reasons.push("Business has not been verified by DealPilot yet");
  if (category.requiresLicence && !isCredentialValid(credentialState(creds, "licence", now).state)) reasons.push(`${category.name} requires a verified, current licence`);
  if (category.requiresInsurance && !isCredentialValid(credentialState(creds, "insurance", now).state)) reasons.push(`${category.name} requires verified, current insurance`);
  return { eligible: reasons.length === 0, reasons };
}

/** Requirements before an administrator can mark a business verified. */
export function verificationBlockers(b: Business, creds: BusinessCredential[], now = new Date()): string[] {
  const out: string[] = [];
  if (!b.abn) out.push("No ABN provided");
  else if (!["abr_active", "admin_confirmed"].includes(b.abnStatus ?? "not_checked")) {
    out.push(b.abnStatus === "checksum_valid" ? "ABN format is valid but its registration hasn't been confirmed (ABN Lookup or manual check)" : "ABN not confirmed active");
  }
  for (const c of creds.filter((x) => x.status === "submitted")) out.push(`${c.kind === "licence" ? "Licence" : "Insurance"} ${c.reference} is awaiting review`);
  for (const kind of ["licence", "insurance"] as const) {
    const s = credentialState(creds, kind, now).state;
    if (s === "expired") out.push(`${kind === "licence" ? "Licence" : "Insurance"} has expired`);
  }
  return out;
}
