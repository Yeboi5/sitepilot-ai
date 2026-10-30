import type { PropertyFacts, PropertyResult } from "./engine";

/**
 * Investment Match Score (Blueprint v2.1): optional, transparent, 0–100, from user-adjustable
 * weights. Each measure maps to 0–100 through fixed, published bands, so a property's score doesn't
 * depend on what it's compared with. Categories without evidence are excluded (never scored as 0),
 * and the score reports its coverage. It is not a prediction or personal financial advice.
 * See docs/FORMULAS.md → score-1.0.0.
 */
export const SCORE_VERSION = "score-1.0.0";
export const MIN_COVERAGE = 0.6;

export const CATEGORIES = ["rental_return", "affordability", "development", "market", "risk", "completeness"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Weights = Record<Category, number>;

export const DEFAULT_WEIGHTS: Weights = { rental_return: 25, affordability: 20, development: 20, market: 15, risk: 15, completeness: 5 };

export const CATEGORY_LABELS: Record<Category, string> = {
  rental_return: "Rental return",
  affordability: "Affordability and cash flow",
  development: "Development feasibility",
  market: "Historical market indicators",
  risk: "Risk",
  completeness: "Data completeness",
};

/** Linear band: `lo` → 0, `hi` → 100, clamped. */
export function band(value: number, lo: number, hi: number): number {
  const t = (value - lo) / (hi - lo);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}

/** The published bands (also rendered on the methodology panel). */
export const BANDS = {
  grossYield: { lo: 0.02, hi: 0.07, label: "Gross yield 2% → 0, 7% → 100" },
  cashOnCash: { lo: -0.1, hi: 0.05, label: "Year-1 cash flow ÷ cash required: −10% → 0, +5% → 100" },
  developmentRoi: { lo: 0, hi: 0.25, label: "Verified feasibility return on cost: 0% → 0, 25% → 100" },
  historicalGrowth: { lo: 0, hi: 0.08, label: "Licensed historical growth: 0% → 0, 8% p.a. → 100" },
  stress: { lo: -0.15, hi: 0, label: "Cash flow at +2% rates ÷ cash required: −15% → 0, 0% → 100" },
  openChecks: { perCheck: 20, label: "Open checks: 100 − 20 per open check" },
} as const;

export type Component = { category: Category; weight: number; score: number | null; reason: string };
export type ScoreResult = { score: number | null; coverage: number; components: Component[]; version: string };

export function scoreProperty(facts: PropertyFacts, r: PropertyResult, weights: Weights): ScoreResult {
  const c = (category: Category, score: number | null, reason: string): Component => ({ category, weight: Math.max(0, weights[category]), score, reason });
  const pctText = (n: number) => `${(n * 100).toFixed(1)}%`;

  const rental = r.grossYield.known
    ? c("rental_return", band(r.grossYield.value, BANDS.grossYield.lo, BANDS.grossYield.hi), `Gross yield ${pctText(r.grossYield.value)}`)
    : c("rental_return", null, `Insufficient evidence: ${r.grossYield.reason.toLowerCase()}`);

  const affordability =
    r.cashFlowYear1.known && r.cashRequired.known && r.cashRequired.value > 0
      ? c(
          "affordability",
          band(r.cashFlowYear1.value / r.cashRequired.value, BANDS.cashOnCash.lo, BANDS.cashOnCash.hi),
          `Year-1 cash flow is ${pctText(r.cashFlowYear1.value / r.cashRequired.value)} of the cash required`,
        )
      : c("affordability", null, `Insufficient evidence: ${(!r.cashFlowYear1.known ? r.cashFlowYear1.reason : !r.cashRequired.known ? r.cashRequired.reason : "no cash required").toLowerCase()}`);

  const development =
    facts.verifiedDevelopmentRoi != null
      ? c("development", band(facts.verifiedDevelopmentRoi, BANDS.developmentRoi.lo, BANDS.developmentRoi.hi), `Verified-evidence scenario returns ${pctText(facts.verifiedDevelopmentRoi)} on cost`)
      : c("development", null, "Insufficient evidence: no feasibility backed by verified planning evidence");

  const market =
    facts.historicalGrowthPct != null
      ? c("market", band(facts.historicalGrowthPct / 100, BANDS.historicalGrowth.lo, BANDS.historicalGrowth.hi), `Licensed historical growth ${facts.historicalGrowthPct.toFixed(1)}% p.a.`)
      : c("market", null, "Insufficient evidence: no licensed price history");

  const stress = r.rateSensitivity.find((s) => s.shiftPp === 2)?.cashFlow;
  const parts: { score: number; text: string }[] = [];
  if (stress?.known && r.cashRequired.known && r.cashRequired.value > 0) {
    const ratio = stress.value / r.cashRequired.value;
    parts.push({ score: band(ratio, BANDS.stress.lo, BANDS.stress.hi), text: `cash flow at +2% rates is ${pctText(ratio)} of cash required` });
  }
  parts.push({ score: Math.max(0, 100 - BANDS.openChecks.perCheck * facts.openChecks), text: `${facts.openChecks} open check${facts.openChecks === 1 ? "" : "s"}` });
  const risk = c("risk", Math.round(parts.reduce((s, p) => s + p.score, 0) / parts.length), parts.map((p) => p.text).join("; "));

  const completeness = c("completeness", Math.round(facts.completeness * 100), `${Math.round(facts.completeness * 100)}% of key data available`);

  const components = [rental, affordability, development, market, risk, completeness];
  const total = components.reduce((s, x) => s + x.weight, 0);
  const scored = components.filter((x) => x.score != null && x.weight > 0);
  const scoredWeight = scored.reduce((s, x) => s + x.weight, 0);
  const coverage = total > 0 ? scoredWeight / total : 0;
  const score = coverage >= MIN_COVERAGE && scoredWeight > 0 ? Math.round(scored.reduce((s, x) => s + x.score! * x.weight, 0) / scoredWeight) : null;
  return { score, coverage: Math.round(coverage * 1000) / 1000, components, version: SCORE_VERSION };
}

/** Highest score first; unscored last; ties keep input order. */
export function rank<T extends { score: number | null }>(items: T[]): T[] {
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (b.x.score ?? -1) - (a.x.score ?? -1) || a.i - b.i)
    .map(({ x }) => x);
}
