import type { Assumptions } from "./assumptions";

/**
 * Deterministic feasibility engine. Pure functions only: same assumptions → same result.
 * The formulas are specified in docs/FORMULAS.md; bump FORMULA_VERSION whenever any output
 * for the same input would change.
 */
export const FORMULA_VERSION = "feasibility-1.0.0";

export type Warning = { code: string; message: string };

export type CostBreakdown = {
  land: number;
  acquisition: number;
  soft: number;
  hard: number;
  contingency: number;
  holding: number;
  financeFees: number;
  interest: number;
  selling: number;
};

export type FeasibilityResult = {
  formulaVersion: string;
  strategy: Assumptions["strategy"];
  costs: CostBreakdown;
  totalDevelopmentCost: number;
  finance: { principalDrawn: number; totalInterest: number; peakDebt: number; equityRequired: number };
  /** Develop and sell. Null for retain and rent. */
  sale: { realisation: number; margin: number; roi: number | null; marginOnRealisation: number | null } | null;
  /** Retain and rent. Null for develop and sell. */
  rent: {
    incrementalCost: number;
    incrementalGrossRentAnnual: number;
    incrementalNetRentAnnual: number;
    yieldOnIncrementalCost: number | null;
    annualInterestAtCompletion: number;
    cashFlowAfterInterestAnnual: number;
    valuationUplift: number;
    upliftMinusCosts: number;
  } | null;
  tax: { basis: "pre_tax"; gst: "not_modelled"; cgt: "not_modelled"; incomeTax: "not_modelled" };
  warnings: Warning[];
};

const cents = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const ratio = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1e6) / 1e6 : null);

/** Hard costs (incl. their contingency) by month: spread evenly over the construction window. */
export function constructionSchedule(a: Assumptions, hardWithContingency: number): number[] {
  const { projectMonths, constructionStartMonth, constructionMonths } = a.timeline;
  const schedule = new Array<number>(projectMonths).fill(0);
  if (constructionMonths === 0) {
    schedule[constructionStartMonth] = hardWithContingency;
  } else {
    const perMonth = hardWithContingency / constructionMonths;
    for (let m = constructionStartMonth; m < constructionStartMonth + constructionMonths; m++) schedule[m] = perMonth;
  }
  return schedule;
}

export function calculate(a: Assumptions): FeasibilityResult {
  const land = a.land.amount;
  const acquisition = a.acquisition.stampDuty + a.acquisition.legalAndOther;
  const soft = a.soft.designAndApprovals;
  const hard = a.hard.demolition + a.hard.siteWorks + a.hard.construction + a.hard.infrastructure;
  const contingencyRate = a.contingencyPct / 100;
  const softContingency = soft * contingencyRate;
  const hardContingency = hard * contingencyRate;
  const holding = a.holding.monthlyHoldingCosts * a.timeline.projectMonths;
  const financeFees = a.finance.financeFees;

  // Debt draw schedule: land debt at month 0; construction debt drawn with construction spend.
  // Interest accrues monthly on the drawn balance and is capitalised (added to the balance).
  const monthlyRate = a.finance.interestRatePct / 100 / 12;
  const landDebt = land * (a.finance.landDebtPct / 100);
  const draws = constructionSchedule(a, hard + hardContingency).map((spend) => spend * (a.finance.constructionDebtPct / 100));
  draws[0] = (draws[0] ?? 0) + landDebt;

  let balance = 0;
  let principalDrawn = 0;
  let interest = 0;
  for (let m = 0; m < a.timeline.projectMonths; m++) {
    const draw = draws[m] ?? 0;
    balance += draw;
    principalDrawn += draw;
    const accrued = balance * monthlyRate;
    interest += accrued;
    balance += accrued;
  }

  const isSale = a.strategy === "develop_and_sell";
  const realisation = isSale ? a.sale.grossRealisation : 0;
  const selling = isSale ? realisation * (a.sale.sellingCostsPct / 100) : 0;

  const costs: CostBreakdown = {
    land: cents(land),
    acquisition: cents(acquisition),
    soft: cents(soft),
    hard: cents(hard),
    contingency: cents(softContingency + hardContingency),
    holding: cents(holding),
    financeFees: cents(financeFees),
    interest: cents(interest),
    selling: cents(selling),
  };
  const tdcRaw = land + acquisition + soft + hard + softContingency + hardContingency + holding + financeFees + interest + selling;
  const totalDevelopmentCost = cents(tdcRaw);

  // Equity funds every cost except interest (capitalised into the loan), selling costs (paid from
  // proceeds) and the principal the lender provides.
  const fundedCosts = land + acquisition + soft + hard + softContingency + hardContingency + holding + financeFees;
  const finance = {
    principalDrawn: cents(principalDrawn),
    totalInterest: cents(interest),
    peakDebt: cents(balance),
    equityRequired: cents(fundedCosts - principalDrawn),
  };

  const warnings: Warning[] = [];
  let sale: FeasibilityResult["sale"] = null;
  let rent: FeasibilityResult["rent"] = null;

  if (isSale) {
    const margin = realisation - tdcRaw;
    sale = {
      realisation: cents(realisation),
      margin: cents(margin),
      roi: ratio(margin, tdcRaw),
      marginOnRealisation: ratio(margin, realisation),
    };
    if (margin < 0) warnings.push({ code: "negative_margin", message: "Margin is negative: costs exceed the assumed sale value." });
  } else {
    // Incremental project: everything except the land you already hold (opportunity cost).
    const incrementalCost = tdcRaw - land;
    const incrementalGross = a.rent.projectedGrossRentAnnual - a.rent.currentGrossRentAnnual;
    const incrementalNet = incrementalGross - a.rent.incrementalOperatingCostsAnnual;
    const annualInterest = balance * (a.finance.interestRatePct / 100);
    const uplift = a.rent.endValue - land;
    rent = {
      incrementalCost: cents(incrementalCost),
      incrementalGrossRentAnnual: cents(incrementalGross),
      incrementalNetRentAnnual: cents(incrementalNet),
      yieldOnIncrementalCost: ratio(incrementalNet, incrementalCost),
      annualInterestAtCompletion: cents(annualInterest),
      cashFlowAfterInterestAnnual: cents(incrementalNet - annualInterest),
      valuationUplift: cents(uplift),
      upliftMinusCosts: cents(uplift - incrementalCost),
    };
    if (uplift - incrementalCost < 0) {
      warnings.push({ code: "negative_uplift", message: "Valuation uplift is less than the incremental cost." });
    }
    if (incrementalNet - annualInterest < 0) {
      warnings.push({ code: "negative_cash_flow", message: "Incremental rent does not cover interest at completion." });
    }
  }

  return {
    formulaVersion: FORMULA_VERSION,
    strategy: a.strategy,
    costs,
    totalDevelopmentCost,
    finance,
    sale,
    rent,
    tax: { basis: "pre_tax", gst: "not_modelled", cgt: "not_modelled", incomeTax: "not_modelled" },
    warnings,
  };
}

/** The headline figure each strategy is judged on (margin, or uplift minus costs). */
export function headline(r: FeasibilityResult): number {
  return r.sale ? r.sale.margin : (r.rent?.upliftMinusCosts ?? 0);
}
