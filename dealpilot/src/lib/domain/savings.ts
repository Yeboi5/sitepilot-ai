import { assertCents, type Cents } from "./money";
import type { Recurrence, Transaction } from "./types";

export const PERIODS_PER_YEAR: Record<Recurrence, number> = {
  one_off: 1,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

export const isRecurring = (r: Recurrence) => r !== "one_off";

export interface SavingsResult {
  periodSavingsCents: Cents;
  /** For recurring savings this is a 12-month PROJECTION, not money already saved. */
  annualSavingsCents: Cents;
  /** Monthly-equivalent saving for recurring bills (0 for one-off purchases). */
  monthlySavingsCents: Cents;
  percent: number;
  isSaving: boolean;
}

export function monthlyEquivalent(periodCents: Cents, recurrence: Recurrence): Cents {
  if (!isRecurring(recurrence)) return 0;
  return Math.round((periodCents * PERIODS_PER_YEAR[recurrence]) / 12);
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
    monthlySavingsCents: monthlyEquivalent(period, recurrence),
    percent: baselineCents === 0 ? 0 : Math.round((period / baselineCents) * 1000) / 10,
    isSaving: period > 0,
  };
}

export interface FeeConfig {
  successFeeCents: Cents;
  currency: string;
}

export interface FeeAssessment {
  qualifies: boolean;
  feeCents: Cents;
  feeStatus: Transaction["feeStatus"];
  reason: string;
}

/**
 * Success-fee rule (product decision, Phase 2):
 *  - charged once per completed, VERIFIED, qualifying transaction;
 *  - qualifying = a real saving (> 0) achieved with a real counterparty or by the customer
 *    themselves; deals with simulated counterparties never qualify;
 *  - capped at the actual saving, so a customer is never worse off;
 *  - nothing for unsuccessful, cancelled or unverified deals.
 * The fee is ASSESSED here. Collection is a separate, explicitly enabled payment step.
 */
export function assessFee(tx: Pick<Transaction, "status" | "periodSavingsCents" | "simulated">, config: FeeConfig): FeeAssessment {
  if (tx.status !== "verified") return { qualifies: false, feeCents: 0, feeStatus: "not_applicable", reason: "Not verified — no fee" };
  if (tx.periodSavingsCents <= 0) return { qualifies: false, feeCents: 0, feeStatus: "waived", reason: "No saving — no fee" };
  if (tx.simulated) return { qualifies: false, feeCents: 0, feeStatus: "not_qualifying", reason: "Simulated counterparty — demonstration only, no fee" };
  const fee = Math.min(config.successFeeCents, tx.periodSavingsCents);
  return {
    qualifies: true,
    feeCents: fee,
    feeStatus: "assessed",
    reason: fee < config.successFeeCents ? "Fee capped at the amount saved" : "Standard success fee",
  };
}

/** @deprecated Phase 1 name, kept for callers; use assessFee. */
export function calculateFee(tx: Pick<Transaction, "status" | "periodSavingsCents"> & { simulated?: boolean }, config: FeeConfig) {
  const a = assessFee({ simulated: false, ...tx }, config);
  return { feeCents: a.feeCents, reason: a.reason };
}

export interface SavingsSummary {
  /** Money actually saved and verified (one verified period per transaction). */
  realisedCents: Cents;
  /** Verified recurring savings expressed per month. */
  monthlyRecurringCents: Cents;
  /** Verified recurring savings projected over 12 months, plus verified one-off savings. Not yet realised. */
  projectedAnnualCents: Cents;
  /** Agreed but not yet verified — not counted anywhere else. */
  pendingCents: Cents;
  feesAssessedCents: Cents;
  verifiedCount: number;
  pendingCount: number;
}

export function summariseSavings(txs: Transaction[]): SavingsSummary {
  const s: SavingsSummary = { realisedCents: 0, monthlyRecurringCents: 0, projectedAnnualCents: 0, pendingCents: 0, feesAssessedCents: 0, verifiedCount: 0, pendingCount: 0 };
  for (const tx of txs) {
    if (tx.status === "verified") {
      s.realisedCents += tx.periodSavingsCents;
      s.monthlyRecurringCents += monthlyEquivalent(tx.periodSavingsCents, tx.recurrence);
      s.projectedAnnualCents += tx.annualSavingsCents;
      s.feesAssessedCents += tx.feeCents;
      s.verifiedCount++;
    } else if (tx.status === "pending_verification") {
      s.pendingCents += tx.periodSavingsCents;
      s.pendingCount++;
    }
  }
  return s;
}
