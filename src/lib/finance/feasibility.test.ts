import { describe, expect, it } from "vitest";
import { EMPTY_ASSUMPTIONS, assumptionsSchema, type Assumptions } from "./assumptions";
import { FORMULA_VERSION, calculate, constructionSchedule } from "./feasibility";
import { applyShift, sensitivity } from "./sensitivity";

// Hand-calculated expectations; see docs/FORMULAS.md for the formulas.

function build(overrides: (a: Assumptions) => void): Assumptions {
  const a: Assumptions = structuredClone(EMPTY_ASSUMPTIONS);
  overrides(a);
  return assumptionsSchema.parse(a);
}

const developNoInterest = build((a) => {
  a.land.amount = 1_000_000;
  a.acquisition = { stampDuty: 40_000, legalAndOther: 5_000 };
  a.soft.designAndApprovals = 50_000;
  a.hard = { demolition: 20_000, siteWorks: 30_000, construction: 800_000, infrastructure: 0 };
  a.contingencyPct = 10;
  a.timeline = { projectMonths: 12, constructionStartMonth: 2, constructionMonths: 8 };
  a.holding.monthlyHoldingCosts = 1_000;
  a.sale = { grossRealisation: 2_400_000, sellingCostsPct: 2 };
});

describe("develop and sell, no finance", () => {
  const r = calculate(developNoInterest);

  it("itemises every cost", () => {
    expect(r.costs).toEqual({
      land: 1_000_000,
      acquisition: 45_000,
      soft: 50_000,
      hard: 850_000,
      contingency: 90_000, // 10% × (50,000 + 850,000)
      holding: 12_000, // 1,000 × 12 months
      financeFees: 0,
      interest: 0,
      selling: 48_000, // 2% × 2,400,000
    });
  });

  it("totals the development cost", () => {
    expect(r.totalDevelopmentCost).toBe(2_095_000);
  });

  it("computes margin and ROI", () => {
    expect(r.sale).toEqual({
      realisation: 2_400_000,
      margin: 305_000,
      roi: 0.145585, // 305,000 / 2,095,000
      marginOnRealisation: 0.127083, // 305,000 / 2,400,000
    });
    expect(r.rent).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it("is pre-tax and stamps the formula version", () => {
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
    expect(r.tax).toEqual({ basis: "pre_tax", gst: "not_modelled", cgt: "not_modelled", incomeTax: "not_modelled" });
  });

  it("is all equity when nothing is borrowed", () => {
    expect(r.finance).toEqual({ principalDrawn: 0, totalInterest: 0, peakDebt: 0, equityRequired: 2_047_000 });
  });
});

describe("finance", () => {
  it("capitalises monthly interest on land debt", () => {
    const r = calculate(
      build((a) => {
        a.land.amount = 1_000_000;
        a.timeline = { projectMonths: 2, constructionStartMonth: 0, constructionMonths: 0 };
        a.finance = { interestRatePct: 6, landDebtPct: 50, constructionDebtPct: 0, financeFees: 0 };
      }),
    );
    // m0: 500,000 × 0.5% = 2,500 → 502,500; m1: 502,500 × 0.5% = 2,512.50 → 505,012.50
    expect(r.finance).toEqual({ principalDrawn: 500_000, totalInterest: 5_012.5, peakDebt: 505_012.5, equityRequired: 500_000 });
    expect(r.costs.interest).toBe(5_012.5);
  });

  it("draws construction debt as construction is spent", () => {
    const r = calculate(
      build((a) => {
        a.hard.construction = 120_000;
        a.timeline = { projectMonths: 4, constructionStartMonth: 1, constructionMonths: 3 };
        a.finance = { interestRatePct: 12, landDebtPct: 0, constructionDebtPct: 100, financeFees: 0 };
      }),
    );
    // m1: 40,000 → +400 = 40,400; m2: 80,400 → +804 = 81,204; m3: 121,204 → +1,212.04 = 122,416.04
    expect(r.finance.totalInterest).toBe(2_416.04);
    expect(r.finance.peakDebt).toBe(122_416.04);
    expect(r.finance.principalDrawn).toBe(120_000);
    expect(r.finance.equityRequired).toBe(0);
  });

  it("includes finance fees in cost and equity", () => {
    const r = calculate(build((a) => (a.finance.financeFees = 7_500)));
    expect(r.costs.financeFees).toBe(7_500);
    expect(r.totalDevelopmentCost).toBe(7_500);
    expect(r.finance.equityRequired).toBe(7_500);
  });
});

describe("construction schedule", () => {
  it("spreads hard costs evenly over the construction window", () => {
    const a = build((x) => (x.timeline = { projectMonths: 5, constructionStartMonth: 1, constructionMonths: 3 }));
    expect(constructionSchedule(a, 900)).toEqual([0, 300, 300, 300, 0]);
  });

  it("puts all hard costs in the start month when construction has no duration", () => {
    const a = build((x) => (x.timeline = { projectMonths: 3, constructionStartMonth: 2, constructionMonths: 0 }));
    expect(constructionSchedule(a, 900)).toEqual([0, 0, 900]);
  });
});

describe("retain and rent", () => {
  const base = (rate: number) =>
    build((a) => {
      a.strategy = "retain_and_rent";
      a.land = { basis: "current_value", amount: 800_000 };
      a.hard.construction = 200_000;
      a.timeline = { projectMonths: 6, constructionStartMonth: 0, constructionMonths: 6 };
      a.finance = { interestRatePct: rate, landDebtPct: 0, constructionDebtPct: 100, financeFees: 0 };
      a.rent = { endValue: 1_100_000, currentGrossRentAnnual: 30_000, projectedGrossRentAnnual: 50_000, incrementalOperatingCostsAnnual: 2_000 };
    });

  it("measures the incremental project", () => {
    const r = calculate(base(0));
    expect(r.totalDevelopmentCost).toBe(1_000_000);
    expect(r.costs.selling).toBe(0);
    expect(r.sale).toBeNull();
    expect(r.rent).toEqual({
      incrementalCost: 200_000, // excludes the 800,000 already held
      incrementalGrossRentAnnual: 20_000,
      incrementalNetRentAnnual: 18_000,
      yieldOnIncrementalCost: 0.09,
      annualInterestAtCompletion: 0,
      cashFlowAfterInterestAnnual: 18_000,
      valuationUplift: 300_000,
      upliftMinusCosts: 100_000,
    });
    expect(r.warnings).toEqual([]);
  });

  it("deducts a year of interest on the completed loan from cash flow", () => {
    const r = calculate(base(6));
    const expectedInterest = Math.round(r.finance.peakDebt * 0.06 * 100) / 100;
    expect(r.rent!.annualInterestAtCompletion).toBe(expectedInterest);
    expect(r.rent!.cashFlowAfterInterestAnnual).toBe(Math.round((18_000 - expectedInterest) * 100) / 100);
    expect(r.rent!.incrementalCost).toBe(Math.round((200_000 + r.finance.totalInterest) * 100) / 100);
  });

  it("warns when rent doesn't cover interest or uplift doesn't cover cost", () => {
    const r = calculate(
      build((a) => {
        a.strategy = "retain_and_rent";
        a.land = { basis: "current_value", amount: 500_000 };
        a.hard.construction = 300_000;
        a.timeline = { projectMonths: 12, constructionStartMonth: 0, constructionMonths: 12 };
        a.finance = { interestRatePct: 8, landDebtPct: 0, constructionDebtPct: 100, financeFees: 0 };
        a.rent = { endValue: 700_000, currentGrossRentAnnual: 0, projectedGrossRentAnnual: 10_000, incrementalOperatingCostsAnnual: 0 };
      }),
    );
    expect(r.warnings.map((w) => w.code)).toEqual(["negative_uplift", "negative_cash_flow"]);
  });
});

describe("edge cases", () => {
  it("all-zero inputs produce zeros and no ratios", () => {
    const r = calculate(EMPTY_ASSUMPTIONS);
    expect(r.totalDevelopmentCost).toBe(0);
    expect(r.sale).toEqual({ realisation: 0, margin: 0, roi: null, marginOnRealisation: null });
    expect(r.warnings).toEqual([]);
  });

  it("warns on a negative margin", () => {
    const r = calculate(build((a) => ((a.land.amount = 500_000), (a.sale.grossRealisation = 400_000))));
    expect(r.sale!.margin).toBe(-100_000);
    expect(r.warnings).toEqual([{ code: "negative_margin", message: expect.stringContaining("negative") }]);
  });

  it("ignores rent inputs for develop and sell, and sale inputs for retain and rent", () => {
    const sell = calculate(build((a) => (a.rent.endValue = 9_999_999)));
    expect(sell.rent).toBeNull();
    const rent = calculate(build((a) => ((a.strategy = "retain_and_rent"), (a.sale = { grossRealisation: 9_999_999, sellingCostsPct: 5 }))));
    expect(rent.sale).toBeNull();
    expect(rent.costs.selling).toBe(0);
  });

  it("is deterministic and does not mutate its input", () => {
    const snapshot = structuredClone(developNoInterest);
    expect(calculate(developNoInterest)).toEqual(calculate(developNoInterest));
    expect(developNoInterest).toEqual(snapshot);
  });

  it("rounds money to cents", () => {
    const r = calculate(build((a) => ((a.hard.construction = 100), (a.contingencyPct = 33.333))));
    expect(r.costs.contingency).toBe(33.33);
  });
});

describe("assumption validation", () => {
  const parse = (f: (a: Assumptions) => void) => {
    const a = structuredClone(EMPTY_ASSUMPTIONS);
    f(a);
    return assumptionsSchema.safeParse(a);
  };

  it("rejects negative money and out-of-range percentages", () => {
    expect(parse((a) => (a.land.amount = -1)).success).toBe(false);
    expect(parse((a) => (a.finance.landDebtPct = 101)).success).toBe(false);
    expect(parse((a) => (a.finance.interestRatePct = 31)).success).toBe(false);
  });

  it("rejects construction outside the project timeline", () => {
    expect(parse((a) => (a.timeline = { projectMonths: 6, constructionStartMonth: 6, constructionMonths: 0 })).success).toBe(false);
    expect(parse((a) => (a.timeline = { projectMonths: 6, constructionStartMonth: 2, constructionMonths: 5 })).success).toBe(false);
    expect(parse((a) => (a.timeline = { projectMonths: 6, constructionStartMonth: 2, constructionMonths: 4 })).success).toBe(true);
  });

  it("rejects fractional months and zero-length projects", () => {
    expect(parse((a) => (a.timeline.projectMonths = 1.5)).success).toBe(false);
    expect(parse((a) => (a.timeline.projectMonths = 0)).success).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(parse((a) => (a.land.amount = Number.NaN)).success).toBe(false);
    expect(parse((a) => (a.land.amount = Number.POSITIVE_INFINITY)).success).toBe(false);
  });
});

describe("sensitivity", () => {
  const s = sensitivity(developNoInterest);

  it("has a 3×3 construction × end-value matrix with the base case in the centre", () => {
    expect(s.matrix).toHaveLength(3);
    expect(s.matrix.every((row) => row.length === 3)).toBe(true);
    expect(s.matrix[1]![1]!.headline).toBe(calculate(developNoInterest).sale!.margin);
  });

  it("applies ±15% to construction and end value", () => {
    // +15% construction: +120,000 hard, +12,000 contingency → margin 305,000 − 132,000
    expect(s.matrix[2]![1]!.headline).toBe(173_000);
    // −15% end value: −360,000 realisation, −7,200 selling → margin 305,000 − 352,800
    expect(s.matrix[1]![0]!.headline).toBe(-47_800);
  });

  it("counts negative outcomes", () => {
    expect(s.metric).toBe("margin");
    expect(s.totalCases).toBe(11); // 9 matrix + 2 interest (base not double-counted)
    expect(s.negativeCases).toBe(s.matrix.flat().filter((c) => c.headline < 0).length);
  });

  it("shifts interest by ±2 percentage points and never below zero", () => {
    expect(s.interest.map((c) => c.interestPp)).toEqual([-2, 0, 2]);
    const shifted = applyShift(developNoInterest, 0, 0, -2);
    expect(shifted.finance.interestRatePct).toBe(0);
  });

  it("higher interest lowers the margin when debt is used", () => {
    const geared = sensitivity(build((a) => ((a.land.amount = 1_000_000), (a.finance.landDebtPct = 60), (a.finance.interestRatePct = 6), (a.sale.grossRealisation = 1_200_000))));
    const [low, base, high] = geared.interest.map((c) => c.headline);
    expect(low!).toBeGreaterThan(base!);
    expect(base!).toBeGreaterThan(high!);
  });

  it("uses uplift minus costs for retain and rent", () => {
    const r = sensitivity(build((a) => (a.strategy = "retain_and_rent")));
    expect(r.metric).toBe("uplift_minus_costs");
  });
});
