import type { Cents } from "./money";
import type { ExpenseLine } from "./types";

export interface GuardianFinding {
  kind: "duplicate_charge" | "subscription" | "price_creep";
  merchant: string;
  lines: ExpenseLine[];
  title: string;
  detail: string;
  /** Estimated avoidable cost over 12 months, if action is taken. */
  potentialAnnualSavingsCents: Cents;
}

const DAY = 86_400_000;
const normalise = (m: string) => m.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(pty|ltd|au|com)$/g, "");

/**
 * Money Guardian analysis over customer-supplied expense lines (manual entry
 * or CSV upload). Read-only: never initiates transfers or requests bank logins.
 */
export function analyseExpenses(lines: ExpenseLine[]): GuardianFinding[] {
  const findings: GuardianFinding[] = [];
  const byMerchant = new Map<string, ExpenseLine[]>();
  for (const l of lines) {
    const k = normalise(l.merchant);
    byMerchant.set(k, [...(byMerchant.get(k) ?? []), l]);
  }

  for (const group of byMerchant.values()) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const merchant = sorted[0].merchant;

    // Duplicate charges: same amount within 3 days.
    const seen = new Set<string>();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        const gap = (new Date(b.date).getTime() - new Date(a.date).getTime()) / DAY;
        if (gap > 3) break;
        if (a.amountCents === b.amountCents && !seen.has(b.id)) {
          seen.add(b.id);
          findings.push({ kind: "duplicate_charge", merchant, lines: [a, b], title: `Possible duplicate charge from ${merchant}`, detail: `Two charges of ${a.amountCents / 100} on ${a.date} and ${b.date}. Check with the merchant or your bank — DealPilot never contacts your bank for you.`, potentialAnnualSavingsCents: a.amountCents });
        }
      }
    }

    // Subscriptions: >= 2 charges roughly monthly (25–35 days apart).
    const recurring = sorted.filter((l) => !seen.has(l.id));
    if (recurring.length >= 2) {
      const gaps = recurring.slice(1).map((l, i) => (new Date(l.date).getTime() - new Date(recurring[i].date).getTime()) / DAY);
      const monthly = gaps.every((g) => g >= 25 && g <= 35);
      if (monthly) {
        const last = recurring[recurring.length - 1].amountCents;
        const first = recurring[0].amountCents;
        findings.push({ kind: "subscription", merchant, lines: recurring, title: `Recurring charge: ${merchant}`, detail: `About ${last / 100} per month (${last * 12 / 100} a year). Still using it? Cancel or negotiate.`, potentialAnnualSavingsCents: last * 12 });
        if (last > first) {
          findings.push({ kind: "price_creep", merchant, lines: recurring, title: `${merchant} increased its price`, detail: `From ${first / 100} to ${last / 100} per month.`, potentialAnnualSavingsCents: (last - first) * 12 });
        }
      }
    }
  }
  return findings.sort((a, b) => b.potentialAnnualSavingsCents - a.potentialAnnualSavingsCents);
}

/** Parses "date,merchant,amount" CSV. Rejects rows that look like account numbers or credentials. */
export function parseExpenseCsv(text: string): { rows: { date: string; merchant: string; amountCents: Cents }[]; errors: string[] } {
  const rows: { date: string; merchant: string; amountCents: Cents }[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.slice(0, 2000).forEach((line, i) => {
    if (i === 0 && /date/i.test(line)) return;
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) { errors.push(`Line ${i + 1}: expected date,merchant,amount`); return; }
    const [date, merchant, amount] = [parts[0], parts.slice(1, -1).join(","), parts[parts.length - 1]];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) { errors.push(`Line ${i + 1}: date must be YYYY-MM-DD`); return; }
    const cents = Math.round(Math.abs(Number(amount.replace(/[$,]/g, ""))) * 100);
    if (!Number.isFinite(cents) || cents === 0) { errors.push(`Line ${i + 1}: invalid amount`); return; }
    if (/\d{6,}/.test(merchant)) { errors.push(`Line ${i + 1}: merchant looks like an account number — removed for your privacy`); return; }
    rows.push({ date, merchant: merchant.slice(0, 80), amountCents: cents });
  });
  return { rows, errors };
}
