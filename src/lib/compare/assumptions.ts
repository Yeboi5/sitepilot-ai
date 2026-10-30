import { z } from "zod";

/**
 * Comparison assumptions (Blueprint v2.1). Every number here is the user's assumption; defaults are
 * labelled examples, identical for every property, so a comparison never carries a hidden forecast.
 */
export const REPAYMENT_TYPES = ["principal_and_interest", "interest_only"] as const;
export const SCENARIOS = ["conservative", "base", "optimistic"] as const;
export type Scenario = (typeof SCENARIOS)[number];

const money = z.number().min(0).max(1_000_000_000);
const pct = (max: number) => z.number().min(0).max(max);

export const compareAssumptionsSchema = z.object({
  depositPct: pct(100),
  interestRatePct: pct(30),
  loanTermYears: z.number().int().min(1).max(40),
  repayment: z.enum(REPAYMENT_TYPES),
  otherPurchaseCosts: money, // conveyancing, inspections, loan fees
  vacancyPct: pct(100),
  managementPct: pct(30), // of rent collected
  insurance: money, // per year
  councilRates: money,
  strata: money,
  maintenance: money,
  landTax: money,
  holdingYears: z.number().int().min(1).max(30),
  growthPct: z.object({ conservative: z.number().min(-10).max(20), base: z.number().min(-10).max(20), optimistic: z.number().min(-10).max(20) }),
  rentGrowthPct: z.number().min(-10).max(20),
  expenseGrowthPct: z.number().min(-10).max(20),
});
export type CompareAssumptions = z.infer<typeof compareAssumptionsSchema>;

/** Example values only: shown as "examples, not forecasts" and editable. */
export const DEFAULT_ASSUMPTIONS: CompareAssumptions = {
  depositPct: 20,
  interestRatePct: 6.2,
  loanTermYears: 30,
  repayment: "principal_and_interest",
  otherPurchaseCosts: 3_000,
  vacancyPct: 4,
  managementPct: 7,
  insurance: 1_800,
  councilRates: 2_200,
  strata: 0,
  maintenance: 2_000,
  landTax: 0,
  holdingYears: 10,
  growthPct: { conservative: 2, base: 4, optimistic: 6 },
  rentGrowthPct: 3,
  expenseGrowthPct: 3,
};

/** Per-property overrides: anything the user knows better for one property. */
export const propertyOverridesSchema = z
  .object({
    price: money.positive(),
    weeklyRent: money.positive(),
    stampDuty: money,
    strata: money,
    councilRates: money,
    insurance: money,
    landTax: money,
  })
  .partial();
export type PropertyOverrides = z.infer<typeof propertyOverridesSchema>;
