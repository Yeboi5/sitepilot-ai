import type { Listing } from "@/lib/discovery/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { SuburbSnapshot } from "@/lib/suburbs/stats";
import type { DevelopmentStatus } from "./development";
import { dutyBracketsSchema, dutyFromBrackets } from "./duty";
import type { PropertyFacts } from "./engine";

export type Estimate = Pick<
  Tables<"property_estimates">,
  "value_low" | "value_mid" | "value_high" | "rent_weekly_low" | "rent_weekly_mid" | "rent_weekly_high" | "confidence" | "source" | "as_of" | "is_demo"
>;
export type DutyPreset = Pick<Tables<"duty_presets">, "state" | "version" | "brackets" | "source_url" | "as_of" | "status">;
export type CompareListing = Listing & { property_record_id: string | null };

/** Everything the comparison screen shows about one property, plus the engine's inputs. */
export type CompareProperty = {
  listing: CompareListing;
  estimate: Estimate | null;
  duty: DutyPreset | null;
  /** The viewer's linked workspace for this property, if any (stage C6). */
  development: DevelopmentStatus | null;
  /** The property's suburb statistics for its dwelling type, if any. */
  suburb: SuburbSnapshot | null;
  facts: PropertyFacts;
};

/**
 * Builds engine inputs from a listing, its latest estimate and the state's duty preset. Listing
 * figures win over estimates; anything missing stays null (shown as Unknown).
 */
export function factsFor(listing: CompareListing, estimate: Estimate | null, duty: DutyPreset | null, development: DevelopmentStatus | null = null,
  suburb: SuburbSnapshot | null = null,
): CompareProperty {
  const forSale = listing.market === "for_sale";
  const price = forSale && listing.asking_price ? listing.asking_price : (estimate?.value_mid ?? null);
  const priceSource = forSale && listing.asking_price ? "listing" : estimate ? "estimate" : null;
  const weeklyRent = listing.indicative_weekly_rent ?? estimate?.rent_weekly_mid ?? null;
  const rentSource = listing.indicative_weekly_rent ? "listing" : estimate?.rent_weekly_mid ? "estimate" : null;
  const brackets = duty ? dutyBracketsSchema.safeParse(duty.brackets) : null;
  const stampDuty = price && brackets?.success ? dutyFromBrackets(brackets.data, price) : null;

  const isLand = listing.property_type === "land";
  const checks = [price != null, weeklyRent != null || isLand, isLand || listing.bedrooms != null, listing.land_area_sqm != null || listing.property_type === "apartment", stampDuty != null, estimate != null];
  return {
    listing,
    estimate,
    duty: brackets?.success ? duty : null,
    development,
    suburb,
    facts: {
      id: listing.id,
      label: listing.headline,
      state: listing.state,
      price,
      priceSource,
      weeklyRent,
      rentSource,
      stampDuty,
      openChecks: listing.risk_flags.length,
      verifiedDevelopmentRoi: development?.roi ?? null, // see development.ts
      // Suburb median growth for this dwelling type (longest of 5 / 3 / 1 years), counts included.
      historicalGrowthPct: suburb?.growth ? Math.round(suburb.growth.perYear * 1000) / 10 : null,
      historicalGrowthBasis: suburb?.growth
        ? `${suburb.suburb} ${suburb.type}s, ${suburb.growth.years} year${suburb.growth.years === 1 ? "" : "s"}, ${suburb.growth.fromCount} → ${suburb.growth.toCount} sales${suburb.isDemo ? ", DEMO" : ""}`
        : null,
      completeness: checks.filter(Boolean).length / checks.length,
    },
  };
}
