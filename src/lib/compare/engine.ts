import type { CompareAssumptions, PropertyOverrides, Scenario } from "./assumptions";
import { SCENARIOS } from "./assumptions";

/**
 * Deterministic investment comparison engine (Blueprint v2.1). Pure functions, no I/O. All results
 * are pre-tax and hypothetical. A metric that can't be calculated is `unknown` with a reason; it is
 * never 0. See docs/FORMULAS.md → investment-1.0.0. Bump the version when outputs change.
 */
export const ENGINE_VERSION = "investment-1.0.0";

export type Metric = { known: true; value: number } | { known: false; reason: string };
export const known = (value: number): Metric => ({ known: true, value });
export const unknown = (reason: string): Metric => ({ known: false, reason });
const both = (a: Metric, b: Metric, f: (x: number, y: number) => number): Metric =>
  !a.known ? a : !b.known ? b : known(f(a.value, b.value));

export type ValueSource = "listing" | "estimate" | "user";

/** What we know about one property, before the user's assumptions. */
export type PropertyFacts = {
  id: string;
  label: string;
  state: string;
  /** Asking price (for sale) or estimated value; null when neither exists. */
  price: number | null;
  priceSource: ValueSource | null;
  weeklyRent: number | null;
  rentSource: ValueSource | null;
  /** Stamp duty for this state and price, when a reviewed preset or the user supplies it. */
  stampDuty: number | null;
  openChecks: number;
  /** Return on cost from a feasibility scenario backed by verified planning evidence, if any. */
  verifiedDevelopmentRoi: number | null;
  /** Licensed historical growth (% p.a.), if any. */
  historicalGrowthPct: number | null;
  completeness: number; // 0–1 share of key fields known
};

export type YearRow = { year: number; value: number; loanBalance: number; equity: number; cashFlow: number | null };
export type Projection = {
  growthPct: number;
  years: YearRow[];
  endValue: number;
  unrealisedGain: number;
  cumulativeCashFlow: Metric;
  /** Equity at the end + cumulative cash flow − cash put in. Pre-tax, before selling costs. */
  netReturn: Metric;
};

export type PropertyResult = {
  id: string;
  price: Metric;
  priceSource: ValueSource | null;
  annualRent: Metric;
  grossYield: Metric;
  netYield: Metric;
  operatingCosts: Metric;
  netOperatingIncome: Metric;
  stampDuty: Metric;
  cashRequired: Metric;
  loan: Metric;
  annualRepayments: Metric;
  annualInterestYear1: Metric;
  cashFlowYear1: Metric;
  /** Year-1 cash flow if the rate were this many percentage points higher (or lower). */
  rateSensitivity: { shiftPp: number; cashFlow: Metric }[];
  projections: Record<Scenario, Projection> | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monthly amortising payment. A 0% rate repays evenly. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

/** Loan balance and interest paid in each year, for `years` years (P&I or interest-only). */
export function amortise(principal: number, a: Pick<CompareAssumptions, "interestRatePct" | "loanTermYears" | "repayment">, years: number) {
  const r = a.interestRatePct / 100 / 12;
  const pay = a.repayment === "interest_only" ? principal * r : monthlyPayment(principal, a.interestRatePct, a.loanTermYears);
  let balance = principal;
  const out: { balance: number; interest: number; payments: number }[] = [];
  for (let y = 0; y < years; y++) {
    let interest = 0;
    let payments = 0;
    for (let m = 0; m < 12; m++) {
      if (balance <= 0) break;
      const i = balance * r;
      const p = a.repayment === "interest_only" ? i : Math.min(pay, balance + i);
      interest += i;
      payments += p;
      balance = balance + i - p;
    }
    out.push({ balance: Math.max(0, balance), interest, payments });
  }
  return out;
}

export function evaluate(facts: PropertyFacts, a: CompareAssumptions, o: PropertyOverrides = {}): PropertyResult {
  const priceValue = o.price ?? facts.price;
  const price = priceValue ? known(priceValue) : unknown("No price or estimated value");
  const priceSource: ValueSource | null = o.price ? "user" : facts.priceSource;
  const rentValue = o.weeklyRent ?? facts.weeklyRent;
  const annualRent = rentValue ? known(rentValue * 52) : unknown("No rent estimate");
  const dutyValue = o.stampDuty ?? facts.stampDuty;
  const stampDuty = dutyValue != null ? known(dutyValue) : unknown("Stamp duty not set");

  const fixedCosts = (o.insurance ?? a.insurance) + (o.councilRates ?? a.councilRates) + (o.strata ?? a.strata) + a.maintenance + (o.landTax ?? a.landTax);
  const collected = (rent: number) => rent * (1 - a.vacancyPct / 100);
  const opCosts = (rent: number, fixed: number) => collected(rent) * (a.managementPct / 100) + fixed;

  const operatingCosts = annualRent.known ? known(opCosts(annualRent.value, fixedCosts)) : unknown("No rent estimate");
  const netOperatingIncome = annualRent.known ? known(collected(annualRent.value) - opCosts(annualRent.value, fixedCosts)) : annualRent;
  const grossYield = both(annualRent, price, (r, p) => r / p);
  const netYield = both(netOperatingIncome, price, (n, p) => n / p);

  const loan = price.known ? known(price.value * (1 - a.depositPct / 100)) : price;
  const cashRequired = both(price, stampDuty, (p, d) => p * (a.depositPct / 100) + d + a.otherPurchaseCosts);
  const schedule = loan.known ? amortise(loan.value, a, Math.max(a.holdingYears, 1)) : null;
  const annualRepayments = schedule ? known(schedule[0]!.payments) : loan;
  const annualInterestYear1 = schedule ? known(schedule[0]!.interest) : loan;
  const cashFlowYear1 = both(netOperatingIncome, annualRepayments, (n, r) => n - r);

  const rateSensitivity = [-1, 1, 2].map((shiftPp) => {
    if (!loan.known || !netOperatingIncome.known) return { shiftPp, cashFlow: !loan.known ? loan : netOperatingIncome };
    const s = amortise(loan.value, { ...a, interestRatePct: Math.max(0, a.interestRatePct + shiftPp) }, 1);
    return { shiftPp, cashFlow: known(netOperatingIncome.value - s[0]!.payments) };
  });

  let projections: PropertyResult["projections"] = null;
  if (price.known && schedule) {
    projections = Object.fromEntries(
      SCENARIOS.map((sc) => {
        const g = a.growthPct[sc] / 100;
        const years: YearRow[] = schedule.map((row, i) => {
          const y = i + 1;
          const value = price.value * (1 + g) ** y;
          const rent = annualRent.known ? annualRent.value * (1 + a.rentGrowthPct / 100) ** i : null;
          const fixed = fixedCosts * (1 + a.expenseGrowthPct / 100) ** i;
          const cashFlow = rent == null ? null : round2(collected(rent) - opCosts(rent, fixed) - row.payments);
          return { year: y, value: round2(value), loanBalance: round2(row.balance), equity: round2(value - row.balance), cashFlow };
        }).slice(0, a.holdingYears);
        const last = years.at(-1)!;
        const cumulative = annualRent.known ? known(years.reduce((s, r) => s + (r.cashFlow ?? 0), 0)) : unknown("No rent estimate");
        const netReturn = both(cumulative, cashRequired, (c, cash) => last.equity + c - cash);
        return [
          sc,
          { growthPct: a.growthPct[sc], years, endValue: last.value, unrealisedGain: round2(last.value - price.value), cumulativeCashFlow: cumulative, netReturn },
        ];
      }),
    ) as Record<Scenario, Projection>;
  }

  return {
    id: facts.id,
    price,
    priceSource,
    annualRent,
    grossYield,
    netYield,
    operatingCosts,
    netOperatingIncome,
    stampDuty,
    cashRequired,
    loan,
    annualRepayments,
    annualInterestYear1,
    cashFlowYear1,
    rateSensitivity,
    projections,
  };
}
