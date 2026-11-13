import { assertCents, type Cents } from "./money";
import type { Recurrence, Transaction } from "./types";

export const PERIODS_PER_YEAR: Record<Recurrence, number> = {
  one_off: 1,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

export interface SavingsResult {
  periodSavingsCents: Cents;
  annualSavingsCents: Cents;
  percent: number;
  isSaving: boolean;
}

/**
 * Savings are the difference between the customer's documented baseline and
 * the final agreed price for the same scope and period. A negative difference
 * is not a saving and is reported as zero (never as a "negative saving").
 */
export function calculateSavings(baselineCents: Cents, finalCents: Cents, recurrence: Recurrence): SavingsResult {
  assertCents(baselineCents, "baseline");
  assertCents(finalCents, "final price");
  if (baselineCents < 0 || finalCents < 0) throw new Error("Prices cannot be negative");
  const diff = baselineCents - finalCents;
  const period = diff > 0 ? diff : 0;
  return {
    periodSavingsCents: period,
    annualSavingsCents: period * PERIODS_PER_YEAR[recurrence],
    percent: baselineCents === 0 ? 0 : Math.round((period / baselineCents) * 1000) / 10,
    isSaving: period > 0,
  };
}

export interface FeeConfig {
  successFeeCents: Cents;
  currency: string;
}

/**
 * Success fee: charged only for a verified, completed transaction with a real
 * saving. Never charged for unsuccessful negotiations, and never more than the
 * saving itself (customers must never be worse off for using DealPilot).
 */
export function calculateFee(
  tx: Pick<Transaction, "status" | "periodSavingsCents">,
  config: FeeConfig,
): { feeCents: Cents; reason: string } {
  if (tx.status !== "verified") return { feeCents: 0, reason: "Not verified — no fee" };
  if (tx.periodSavingsCents <= 0) return { feeCents: 0, reason: "No saving — no fee" };
  const fee = Math.min(config.successFeeCents, tx.periodSavingsCents);
  return { feeCents: fee, reason: fee < config.successFeeCents ? "Fee capped at the amount saved" : "Standard success fee" };
}

export interface SavingsSummary {
  verifiedAnnualCents: Cents;
  pendingAnnualCents: Cents;
  feesCents: Cents;
  netAnnualCents: Cents;
  verifiedCount: number;
  pendingCount: number;
}

export function summariseSavings(txs: Transaction[]): SavingsSummary {
  let verifiedAnnualCents = 0, pendingAnnualCents = 0, feesCents = 0, verifiedCount = 0, pendingCount = 0;
  for (const tx of txs) {
    if (tx.status === "verified") {
      verifiedAnnualCents += tx.annualSavingsCents;
      feesCents += tx.feeCents;
      verifiedCount++;
    } else if (tx.status === "pending_verification") {
      pendingAnnualCents += tx.annualSavingsCents;
      pendingCount++;
    }
  }
  return { verifiedAnnualCents, pendingAnnualCents, feesCents, netAnnualCents: verifiedAnnualCents - feesCents, verifiedCount, pendingCount };
}
