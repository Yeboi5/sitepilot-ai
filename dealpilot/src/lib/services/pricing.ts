import { CdrEnergyClient, compareEnergyPlans, DEFAULT_BRANDS, type ComparisonResult } from "../integrations/cdr-energy";
import { requireRole, ValidationError } from "../domain/permissions";
import type { Actor } from "../domain/types";
import { audit, type Ctx } from "./context";
import { enforceRateLimit } from "./rate-limit";

/**
 * Authorised external pricing sources. Every source declares its provenance so the UI can label
 * it; nothing here is scraped and nothing is fabricated when a source fails.
 */
export interface PricingSourceInfo {
  id: string;
  name: string;
  provenance: "live" | "simulated";
  categories: string[];
  attribution: string;
  terms: string;
}

export const PRICING_SOURCES: PricingSourceInfo[] = [
  {
    id: "cdr-energy-made-easy",
    name: "Energy Made Easy (Australian Energy Regulator)",
    provenance: "live",
    categories: ["energy"],
    attribution: "Plan data: Australian Energy Regulator, Energy Made Easy, via Consumer Data Right Product Reference Data.",
    terms: "Public Product Reference Data under the Consumer Data Right. Estimates are DealPilot's, not the retailer's or the AER's.",
  },
  {
    id: "simulated-retail-feed",
    name: "Simulated retail price feed",
    provenance: "simulated",
    categories: ["retail"],
    attribution: "Demonstration only.",
    terms: "Replace with approved retailer or affiliate APIs before launch.",
  },
];

const client = new CdrEnergyClient();

export interface EnergyQuery {
  postcode: string;
  /** Average daily usage in kWh (from the customer's bill). */
  dailyKwh: number;
  /** What the customer pays now per year (optional, for savings estimates). */
  currentAnnualCents?: number;
}

export async function compareEnergy(ctx: Ctx & { energyClient?: CdrEnergyClient; taxRate?: number }, actor: Actor, q: EnergyQuery): Promise<ComparisonResult & { query: EnergyQuery }> {
  requireRole(actor, "customer");
  if (!/^\d{4}$/.test(q.postcode)) throw new ValidationError("Enter a 4-digit Australian postcode");
  if (!Number.isFinite(q.dailyKwh) || q.dailyKwh <= 0 || q.dailyKwh > 200) throw new ValidationError("Enter your average daily usage in kWh (it's on your bill)");
  await enforceRateLimit(ctx, "externalPricing", `user:${actor.userId}`);
  const brands = (process.env.CDR_ENERGY_BRANDS?.split(",").map((s) => s.trim()).filter(Boolean)) ?? DEFAULT_BRANDS.slice(0, 5);
  // CDR energy prices are published exclusive of GST; estimates add it (configurable for review).
  const taxRate = ctx.taxRate ?? (process.env.CDR_PRICES_INCLUDE_GST === "true" ? 0 : 0.1);
  const result = await compareEnergyPlans(ctx.energyClient ?? client, { postcode: q.postcode, dailyKwh: q.dailyKwh, brands, taxRate });
  await audit(ctx, actor, "pricing.energy_compared", "pricing", "cdr-energy-made-easy", { postcode: q.postcode, plans: result.plans.length, failed: result.brandsFailed });
  if (result.plans.length === 0 && result.brandsFailed.length === brands.length) {
    throw new ValidationError("Energy Made Easy is unavailable right now. No prices are shown rather than guessing — please try again later.");
  }
  return { ...result, query: q };
}
