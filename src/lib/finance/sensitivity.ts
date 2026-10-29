import type { Assumptions } from "./assumptions";
import { calculate, headline, type FeasibilityResult } from "./feasibility";

/** Blueprint §8: construction ±15%, end value ±15%, interest ±2 percentage points. */
export const CONSTRUCTION_STEPS = [-15, 0, 15] as const;
export const END_VALUE_STEPS = [-15, 0, 15] as const;
export const INTEREST_STEPS_PP = [-2, 0, 2] as const;

export type SensitivityCase = {
  constructionPct: number;
  endValuePct: number;
  interestPp: number;
  /** Margin (develop and sell) or valuation uplift minus costs (retain and rent). */
  headline: number;
  roi: number | null;
  yieldOnIncrementalCost: number | null;
  result: FeasibilityResult;
};

export type Sensitivity = {
  metric: "margin" | "uplift_minus_costs";
  /** matrix[i][j]: construction step i × end-value step j, base interest. */
  matrix: SensitivityCase[][];
  interest: SensitivityCase[];
  negativeCases: number;
  totalCases: number;
};

const scale = (x: number, pct: number) => x * (1 + pct / 100);

export function applyShift(a: Assumptions, constructionPct: number, endValuePct: number, interestPp: number): Assumptions {
  return {
    ...a,
    hard: { ...a.hard, construction: scale(a.hard.construction, constructionPct) },
    sale: { ...a.sale, grossRealisation: scale(a.sale.grossRealisation, endValuePct) },
    rent: { ...a.rent, endValue: scale(a.rent.endValue, endValuePct) },
    finance: { ...a.finance, interestRatePct: Math.max(0, a.finance.interestRatePct + interestPp) },
  };
}

function runCase(a: Assumptions, constructionPct: number, endValuePct: number, interestPp: number): SensitivityCase {
  const result = calculate(applyShift(a, constructionPct, endValuePct, interestPp));
  return {
    constructionPct,
    endValuePct,
    interestPp,
    headline: headline(result),
    roi: result.sale?.roi ?? null,
    yieldOnIncrementalCost: result.rent?.yieldOnIncrementalCost ?? null,
    result,
  };
}

export function sensitivity(a: Assumptions): Sensitivity {
  const matrix = CONSTRUCTION_STEPS.map((c) => END_VALUE_STEPS.map((v) => runCase(a, c, v, 0)));
  const interest = INTEREST_STEPS_PP.map((pp) => runCase(a, 0, 0, pp));
  const all = [...matrix.flat(), ...interest.filter((c) => c.interestPp !== 0)];
  return {
    metric: a.strategy === "develop_and_sell" ? "margin" : "uplift_minus_costs",
    matrix,
    interest,
    negativeCases: all.filter((c) => c.headline < 0).length,
    totalCases: all.length,
  };
}
