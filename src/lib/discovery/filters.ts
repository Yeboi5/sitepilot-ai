import { isState, type State } from "@/lib/jurisdictions";
import { grossYield } from "./signals";
import type { Kind, Listing, Market } from "./types";

/**
 * Discover filters (the usual property-app set). Parsed from the URL so a filtered deck can be
 * bookmarked or shared. Unknown or out-of-range values are ignored, never errors.
 * Price filters apply to asking prices only: off-market homes are NOT FOR SALE and have none.
 */
export const PROPERTY_TYPES = ["house", "townhouse", "apartment", "duplex", "land"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const TYPE_LABEL: Record<PropertyType, string> = { house: "House", townhouse: "Townhouse", apartment: "Apartment", duplex: "Duplex", land: "Land" };

export const PRICE_STEPS = [300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_250_000, 1_500_000, 2_000_000, 3_000_000] as const;
export const LAND_STEPS = [200, 300, 450, 600, 800, 1000] as const;
export const YIELD_STEPS = [3, 4, 5, 6] as const;
export const SORTS = { newest: "Newest", price_asc: "Price (low to high)", price_desc: "Price (high to low)" } as const;
export type Sort = keyof typeof SORTS;

export type Filters = {
  state: State | null;
  priceMin: number | null;
  priceMax: number | null;
  types: PropertyType[];
  beds: number;
  baths: number;
  cars: number;
  landMin: number | null;
  yieldMin: number | null;
  sort: Sort;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = <T extends number>(v: string | undefined, allowed: readonly T[]) => {
  const n = Number(v);
  return (allowed as readonly number[]).includes(n) ? (n as T) : null;
};
const atLeast = (v: string | undefined, max: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

export function parseFilters(raw: Raw, kind: Kind): Filters {
  // "type" arrives comma-separated (links) or repeated (the filter form's checkboxes).
  const types = (Array.isArray(raw.type) ? raw.type.join(",") : (raw.type ?? ""))
    .split(",")
    .filter((t): t is PropertyType => (PROPERTY_TYPES as readonly string[]).includes(t));
  let priceMin = pick(one(raw.min), PRICE_STEPS);
  let priceMax = pick(one(raw.max), PRICE_STEPS);
  if (priceMin && priceMax && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
  const sort = one(raw.sort);
  return {
    state: isState(one(raw.state)) ? (one(raw.state) as State) : null,
    priceMin,
    priceMax,
    types: [...new Set(types)],
    beds: atLeast(one(raw.beds), 6),
    baths: atLeast(one(raw.baths), 4),
    cars: atLeast(one(raw.cars), 4),
    landMin: pick(one(raw.land), LAND_STEPS),
    yieldMin: kind === "investment" ? pick(one(raw.yield), YIELD_STEPS) : null,
    sort: sort && sort in SORTS ? (sort as Sort) : "newest",
  };
}

/** URL parameters for these filters (only the ones in use). */
export function filterParams(f: Filters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.state) p.state = f.state;
  if (f.priceMin) p.min = String(f.priceMin);
  if (f.priceMax) p.max = String(f.priceMax);
  if (f.types.length) p.type = f.types.join(",");
  if (f.beds) p.beds = String(f.beds);
  if (f.baths) p.baths = String(f.baths);
  if (f.cars) p.cars = String(f.cars);
  if (f.landMin) p.land = String(f.landMin);
  if (f.yieldMin) p.yield = String(f.yieldMin);
  if (f.sort !== "newest") p.sort = f.sort;
  return p;
}

/** How many filters are in effect (sorting doesn't count; price doesn't apply off-market). */
export function activeCount(f: Filters, market: Market = "for_sale"): number {
  const priced = market === "for_sale";
  return [f.state, priced && f.priceMin, priced && f.priceMax, f.types.length, f.beds, f.baths, f.cars, f.landMin, priced && f.yieldMin].filter(Boolean).length;
}

/**
 * Applies the filters to listings. Pure, so the same rules run on the server and in tests. A
 * listing with an unknown value fails a filter on that value (e.g. "3+ beds" excludes land).
 */
export function applyFilters<L extends Pick<Listing, "state" | "asking_price" | "property_type" | "bedrooms" | "bathrooms" | "car_spaces" | "land_area_sqm" | "indicative_weekly_rent" | "listed_on" | "id">>(
  listings: L[],
  f: Filters,
  market: Market,
): L[] {
  const priced = market === "for_sale";
  const out = listings.filter((l) => {
    if (f.state && l.state !== f.state) return false;
    if (priced && f.priceMin && (l.asking_price ?? 0) < f.priceMin) return false;
    if (priced && f.priceMax && (l.asking_price == null || l.asking_price > f.priceMax)) return false;
    if (f.types.length && !f.types.includes(l.property_type as PropertyType)) return false;
    if (f.beds && (l.bedrooms ?? 0) < f.beds) return false;
    if (f.baths && (l.bathrooms ?? 0) < f.baths) return false;
    if (f.cars && (l.car_spaces ?? 0) < f.cars) return false;
    if (f.landMin && (l.land_area_sqm ?? 0) < f.landMin) return false;
    if (priced && f.yieldMin) {
      const y = grossYield(l.asking_price, l.indicative_weekly_rent);
      if (y == null || y * 100 < f.yieldMin) return false;
    }
    return true;
  });
  if (priced && f.sort !== "newest") {
    const dir = f.sort === "price_asc" ? 1 : -1;
    out.sort((a, b) => dir * ((a.asking_price ?? 0) - (b.asking_price ?? 0)) || a.id.localeCompare(b.id));
  }
  return out;
}
