import { z } from "zod";

/**
 * Inputs to the feasibility engine. Every value is an investor ASSUMPTION, not a sourced fact.
 * Money is whole or fractional AUD, excluding GST (tax is not modelled, see FORMULAS.md).
 */

const money = z.number({ message: "Enter an amount" }).finite().min(0, "Can't be negative").max(1_000_000_000, "Too large");
const pct = (max: number) => z.number({ message: "Enter a percentage" }).finite().min(0, "Can't be negative").max(max, `At most ${max}%`);
const months = z.number({ message: "Enter a number of months" }).int("Whole months only").min(0, "Can't be negative");

export const STRATEGIES = ["develop_and_sell", "retain_and_rent"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export const STRATEGY_LABELS: Record<Strategy, string> = {
  develop_and_sell: "Develop and sell",
  retain_and_rent: "Retain and rent",
};

export const assumptionsSchema = z
  .object({
    strategy: z.enum(STRATEGIES),
    land: z.object({
      /** purchase_price: buying the site; current_value: already owned, counted as opportunity cost. */
      basis: z.enum(["purchase_price", "current_value"]),
      amount: money,
    }),
    acquisition: z.object({
      /** Investor's own estimate. Not calculated by SitePilot. */
      stampDuty: money,
      legalAndOther: money,
    }),
    soft: z.object({ designAndApprovals: money }),
    hard: z.object({ demolition: money, siteWorks: money, construction: money, infrastructure: money }),
    contingencyPct: pct(50),
    timeline: z.object({
      projectMonths: months.min(1, "At least 1 month").max(240, "At most 240 months"),
      constructionStartMonth: months,
      constructionMonths: months.max(240),
    }),
    finance: z.object({
      interestRatePct: pct(30),
      landDebtPct: pct(100),
      constructionDebtPct: pct(100),
      financeFees: money,
    }),
    holding: z.object({ monthlyHoldingCosts: money }),
    sale: z.object({ grossRealisation: money, sellingCostsPct: pct(20) }),
    rent: z.object({
      endValue: money,
      currentGrossRentAnnual: money,
      projectedGrossRentAnnual: money,
      incrementalOperatingCostsAnnual: money,
    }),
  })
  .superRefine((a, ctx) => {
    const { projectMonths, constructionStartMonth, constructionMonths } = a.timeline;
    if (constructionStartMonth >= projectMonths) {
      ctx.addIssue({ code: "custom", path: ["timeline", "constructionStartMonth"], message: "Must start before the project ends" });
    }
    if (constructionStartMonth + constructionMonths > projectMonths) {
      ctx.addIssue({ code: "custom", path: ["timeline", "constructionMonths"], message: "Construction must finish within the project duration" });
    }
  });

export type Assumptions = z.infer<typeof assumptionsSchema>;

/** Blank starting point for the scenario editor. */
export const EMPTY_ASSUMPTIONS: Assumptions = {
  strategy: "develop_and_sell",
  land: { basis: "purchase_price", amount: 0 },
  acquisition: { stampDuty: 0, legalAndOther: 0 },
  soft: { designAndApprovals: 0 },
  hard: { demolition: 0, siteWorks: 0, construction: 0, infrastructure: 0 },
  contingencyPct: 0,
  timeline: { projectMonths: 12, constructionStartMonth: 0, constructionMonths: 0 },
  finance: { interestRatePct: 0, landDebtPct: 0, constructionDebtPct: 0, financeFees: 0 },
  holding: { monthlyHoldingCosts: 0 },
  sale: { grossRealisation: 0, sellingCostsPct: 0 },
  rent: { endValue: 0, currentGrossRentAnnual: 0, projectedGrossRentAnnual: 0, incrementalOperatingCostsAnnual: 0 },
};
