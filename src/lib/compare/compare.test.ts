import { describe, expect, it } from "vitest";
import { compareAssumptionsSchema, DEFAULT_ASSUMPTIONS, type CompareAssumptions } from "./assumptions";
import { amortise, evaluate, monthlyPayment, type PropertyFacts } from "./engine";
import { band, DEFAULT_WEIGHTS, MIN_COVERAGE, rank, scoreProperty, type Weights } from "./score";

// Hand-calculated expectations; formulas in docs/FORMULAS.md (investment-1.0.0, score-1.0.0).

const A: CompareAssumptions = { ...DEFAULT_ASSUMPTIONS, interestRatePct: 6 };

function facts(over: Partial<PropertyFacts> = {}): PropertyFacts {
  return {
    id: "p1",
    label: "Test",
    state: "NSW",
    price: 500_000,
    priceSource: "listing",
    weeklyRent: 500,
    rentSource: "listing",
    stampDuty: 17_000,
    openChecks: 1,
    verifiedDevelopmentRoi: null,
    historicalGrowthPct: null,
    completeness: 0.8,
    ...over,
  };
}

describe("loan maths", () => {
  it("matches the standard amortising payment", () => {
    expect(monthlyPayment(400_000, 6, 30)).toBeCloseTo(2398.2, 2);
    expect(monthlyPayment(120_000, 0, 10)).toBe(1000);
    expect(monthlyPayment(0, 6, 30)).toBe(0);
  });
  it("interest-only keeps the balance and charges rate × balance", () => {
    const [y1] = amortise(400_000, { interestRatePct: 6, loanTermYears: 30, repayment: "interest_only" }, 1);
    expect(y1!.balance).toBeCloseTo(400_000, 6);
    expect(y1!.payments).toBeCloseTo(24_000, 6);
  });
  it("P&I reduces the balance and pays it off over the term", () => {
    const rows = amortise(400_000, { interestRatePct: 6, loanTermYears: 30, repayment: "principal_and_interest" }, 30);
    expect(rows[0]!.balance).toBeLessThan(400_000);
    expect(rows[0]!.payments).toBeCloseTo(2398.2033 * 12, 1);
    expect(rows[29]!.balance).toBeCloseTo(0, 2);
  });
});

describe("evaluate", () => {
  const r = evaluate(facts(), A);

  it("yields: gross = annual rent ÷ price; net = (collected rent − costs) ÷ price", () => {
    expect(r.annualRent).toEqual({ known: true, value: 26_000 });
    expect(r.grossYield).toEqual({ known: true, value: 0.052 });
    // collected 24,960; management 7% = 1,747.20; fixed 1,800 + 2,200 + 2,000 = 6,000
    expect(r.operatingCosts.known && r.operatingCosts.value).toBeCloseTo(7_747.2, 6);
    expect(r.netOperatingIncome.known && r.netOperatingIncome.value).toBeCloseTo(17_212.8, 6);
    expect(r.netYield.known && r.netYield.value).toBeCloseTo(0.0344256, 7);
  });

  it("cash required = deposit + duty + other costs; cash flow = NOI − repayments", () => {
    expect(r.cashRequired).toEqual({ known: true, value: 120_000 });
    expect(r.loan).toEqual({ known: true, value: 400_000 });
    expect(r.annualRepayments.known && r.annualRepayments.value).toBeCloseTo(28_778.44, 1);
    expect(r.cashFlowYear1.known && r.cashFlowYear1.value).toBeCloseTo(17_212.8 - 28_778.44, 1);
  });

  it("rate sensitivity: higher rates, lower cash flow", () => {
    const [down, up1, up2] = r.rateSensitivity.map((s) => (s.cashFlow.known ? s.cashFlow.value : NaN));
    expect(down).toBeGreaterThan(up1!);
    expect(up1).toBeGreaterThan(up2!);
    expect(r.cashFlowYear1.known && r.cashFlowYear1.value).toBeLessThan(down!);
  });

  it("projections: value grows at each scenario's rate; gains, equity and cash flow are separate", () => {
    const base = r.projections!.base;
    expect(base.years).toHaveLength(10);
    expect(base.endValue).toBeCloseTo(500_000 * 1.04 ** 10, 1);
    expect(base.unrealisedGain).toBeCloseTo(500_000 * 1.04 ** 10 - 500_000, 1);
    expect(r.projections!.conservative.endValue).toBeLessThan(base.endValue);
    expect(r.projections!.optimistic.endValue).toBeGreaterThan(base.endValue);
    const last = base.years.at(-1)!;
    expect(last.equity).toBeCloseTo(last.value - last.loanBalance, 1);
    // Year 2 rent grows 3%: cash flow improves.
    expect(base.years[1]!.cashFlow!).toBeGreaterThan(base.years[0]!.cashFlow!);
    const cum = base.years.reduce((s, y) => s + y.cashFlow!, 0);
    expect(base.cumulativeCashFlow.known && base.cumulativeCashFlow.value).toBeCloseTo(cum, 6);
    expect(base.netReturn.known && base.netReturn.value).toBeCloseTo(last.equity + cum - 120_000, 4);
  });

  it("missing rent is unknown, never zero", () => {
    const x = evaluate(facts({ weeklyRent: null, rentSource: null }), A);
    expect(x.grossYield).toEqual({ known: false, reason: "No rent estimate" });
    expect(x.cashFlowYear1.known).toBe(false);
    expect(x.cashRequired.known).toBe(true); // doesn't depend on rent
    expect(x.projections!.base.cumulativeCashFlow.known).toBe(false);
    expect(x.projections!.base.netReturn.known).toBe(false);
    expect(x.projections!.base.years[0]!.cashFlow).toBeNull();
  });

  it("missing price makes every price-based figure unknown", () => {
    const x = evaluate(facts({ price: null, priceSource: null }), A);
    for (const m of [x.price, x.grossYield, x.netYield, x.loan, x.cashRequired, x.cashFlowYear1]) expect(m.known).toBe(false);
    expect(x.projections).toBeNull();
  });

  it("missing stamp duty leaves cash required unknown", () => {
    expect(evaluate(facts({ stampDuty: null }), A).cashRequired).toEqual({ known: false, reason: "Stamp duty not set" });
  });

  it("overrides win and are labelled as the user's", () => {
    const x = evaluate(facts({ price: null, priceSource: null }), A, { price: 600_000, stampDuty: 22_000 });
    expect(x.price).toEqual({ known: true, value: 600_000 });
    expect(x.priceSource).toBe("user");
    expect(evaluate(facts({ priceSource: "estimate" }), A).priceSource).toBe("estimate");
  });

  it("validates assumptions", () => {
    expect(compareAssumptionsSchema.safeParse(DEFAULT_ASSUMPTIONS).success).toBe(true);
    expect(compareAssumptionsSchema.safeParse({ ...DEFAULT_ASSUMPTIONS, interestRatePct: 45 }).success).toBe(false);
    expect(compareAssumptionsSchema.safeParse({ ...DEFAULT_ASSUMPTIONS, holdingYears: 0 }).success).toBe(false);
  });
});

describe("Investment Match Score", () => {
  it("bands are linear and clamped", () => {
    expect(band(0.045, 0.02, 0.07)).toBe(50);
    expect(band(0.01, 0.02, 0.07)).toBe(0);
    expect(band(0.2, 0.02, 0.07)).toBe(100);
  });

  it("scores available categories and reports coverage; missing evidence is excluded, not zero", () => {
    const f = facts();
    const s = scoreProperty(f, evaluate(f, A), DEFAULT_WEIGHTS);
    const byCat = Object.fromEntries(s.components.map((c) => [c.category, c]));
    expect(byCat.rental_return!.score).toBe(64); // 5.2% → (5.2 − 2) / 5
    expect(byCat.development!.score).toBeNull();
    expect(byCat.market!.score).toBeNull();
    expect(byCat.development!.reason).toMatch(/Insufficient evidence/);
    expect(s.coverage).toBe(0.65); // 25 + 20 + 15 + 5 of 100
    const expected = Math.round(s.components.filter((c) => c.score != null).reduce((t, c) => t + c.score! * c.weight, 0) / 65);
    expect(s.score).toBe(expected);
  });

  it("gives no overall score below the coverage threshold", () => {
    const f = facts({ weeklyRent: null, rentSource: null });
    const s = scoreProperty(f, evaluate(f, A), DEFAULT_WEIGHTS);
    expect(s.coverage).toBeLessThan(MIN_COVERAGE);
    expect(s.score).toBeNull();
  });

  it("verified development evidence and licensed history count when present", () => {
    const f = facts({ verifiedDevelopmentRoi: 0.125, historicalGrowthPct: 4 });
    const s = scoreProperty(f, evaluate(f, A), DEFAULT_WEIGHTS);
    expect(s.coverage).toBe(1);
    expect(s.components.find((c) => c.category === "development")!.score).toBe(50);
    expect(s.components.find((c) => c.category === "market")!.score).toBe(50);
  });

  it("open checks lower the risk score", () => {
    const risk = (n: number) => {
      const f = facts({ openChecks: n });
      return scoreProperty(f, evaluate(f, A), DEFAULT_WEIGHTS).components.find((c) => c.category === "risk")!.score!;
    };
    expect(risk(0)).toBeGreaterThan(risk(3));
  });

  it("changing weights changes the ranking", () => {
    const highYield = facts({ id: "yield", price: 400_000, weeklyRent: 520, stampDuty: 13_000, openChecks: 5 });
    const lowRisk = facts({ id: "safe", price: 500_000, weeklyRent: 420, stampDuty: 17_000, openChecks: 0 });
    const order = (w: Weights) =>
      rank([highYield, lowRisk].map((f) => ({ id: f.id, score: scoreProperty(f, evaluate(f, A), w).score }))).map((x) => x.id);
    const only = (c: keyof Weights): Weights => ({ rental_return: 0, affordability: 0, development: 0, market: 0, risk: 0, completeness: 0, [c]: 100 });
    expect(order(only("rental_return"))).toEqual(["yield", "safe"]);
    expect(order(only("risk"))).toEqual(["safe", "yield"]);
    expect(order(DEFAULT_WEIGHTS)).toEqual(["yield", "safe"]);
  });

  it("ranks unscored properties last and keeps ties in order", () => {
    expect(rank([{ id: "a", score: null }, { id: "b", score: 40 }, { id: "c", score: 40 }]).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});

describe("explanations and questions", async () => {
  const { explain, QUESTIONS } = await import("./explain");
  const mk = (id: string, f: Partial<PropertyFacts>) => {
    const pf = facts({ id, label: id, ...f });
    const result = evaluate(pf, A);
    return { id, label: id, result, score: scoreProperty(pf, result, DEFAULT_WEIGHTS) };
  };
  const rows = [mk("Alpha", { price: 400_000, weeklyRent: 520, stampDuty: 13_000 }), mk("Bravo", { price: 600_000, weeklyRent: 480, stampDuty: 22_000 })];

  it("names the leader and the main reasons", () => {
    const lines = explain(rows, A);
    expect(lines[0]).toMatch(/^Alpha ranks first with \d+\/100, mainly on rental return/);
    expect(lines.at(-1)).toMatch(/excluded until there's verified planning evidence/);
  });

  it("answers questions from the engine's numbers", () => {
    const q = Object.fromEntries(QUESTIONS.map((x) => [x.id, x.answer(rows, A)]));
    expect(q.cash_required).toMatch(/^Alpha: \$96,000/); // 80,000 + 13,000 + 3,000
    expect(q.gross_yield).toMatch(/^Alpha: 6\.8%/);
    expect(q.net_return).toMatch(/over 10 years in the base scenario \(4% growth a year, your assumption\)/);
  });

  it("says when there isn't enough evidence", () => {
    const none = [mk("A", { price: null, priceSource: null }), mk("B", { price: null, priceSource: null })];
    expect(explain(none, A)[0]).toMatch(/None of these properties has enough evidence/);
    expect(QUESTIONS[0]!.answer(none, A)).toMatch(/enough data/);
  });
});

describe("Quick Compare", async () => {
  const { quickMatch, DEFAULT_PRIORITIES } = await import("./quick");
  const q = (id: string, f: Partial<PropertyFacts>, bedrooms: number | null = 3, land: number | null = 500) => {
    const pf = facts({ id, label: id, ...f });
    return { id, label: id, result: evaluate(pf, A), bedrooms, landAreaSqm: land };
  };
  const cheap = q("Cheap", { price: 400_000, weeklyRent: 450, stampDuty: 13_000 }, 2, 300);
  const roomy = q("Roomy", { price: 700_000, weeklyRent: 600, stampDuty: 26_000 }, 5, 700);
  const middle = q("Middle", { price: 550_000, weeklyRent: 480, stampDuty: 20_000 }, 3, 450);

  it("picks the property that best matches the chosen priorities", () => {
    expect(quickMatch([cheap, roomy, middle], ["lowest_repayments"]).best?.id).toBe("Cheap");
    expect(quickMatch([cheap, roomy, middle], ["space", "land"]).best?.id).toBe("Roomy");
    const m = quickMatch([cheap, roomy, middle], DEFAULT_PRIORITIES.homebuyer);
    expect(m.ranking.map((r) => r.id)).toEqual(["Cheap", "Roomy", "Middle"]);
  });

  it("explains the match with the actual figures", () => {
    const m = quickMatch([cheap, roomy], ["lowest_repayments"]);
    expect(m.explanation[0]).toMatch(/^Cheap best matches your priorities, with the lowest repayments \(\$1,\d{3}\/month\)\.$/);
  });

  it("calls a tie a tie", () => {
    const m = quickMatch([cheap, roomy], ["lowest_repayments", "space"]);
    expect(m.tie).toBe(true);
    expect(m.best).toBeNull();
    expect(m.explanation[0]).toMatch(/even match/);
  });

  it("unknown values earn no points and are named; a priority without data is skipped", () => {
    const noRent = q("NoRent", { weeklyRent: null, rentSource: null });
    const m = quickMatch([cheap, noRent], ["rental_return", "lowest_price"]);
    expect(m.explanation.join(" ")).toMatch(/Rental return: not enough data to compare \(unknown for NoRent\)/);
    expect(m.best?.id).toBe("Cheap");
    expect(quickMatch([noRent, q("Also", { weeklyRent: null })], ["rental_return"]).best).toBeNull();
  });
});
