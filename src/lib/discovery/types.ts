import type { Tables } from "@/lib/supabase/database.types";

export type Listing = Pick<
  Tables<"listings">,
  | "id"
  | "kind"
  | "market"
  | "is_demo"
  | "headline"
  | "description"
  | "property_type"
  | "state"
  | "suburb"
  | "postcode"
  | "street_address"
  | "bedrooms"
  | "bathrooms"
  | "car_spaces"
  | "land_area_sqm"
  | "asking_price"
  | "price_display"
  | "indicative_weekly_rent"
  | "development_idea"
  | "risk_flags"
  | "lifestyle_tags"
  | "illustration_seed"
  | "provenance"
  | "listed_on"
>;

export const LISTING_COLUMNS =
  "id, kind, market, is_demo, headline, description, property_type, state, suburb, postcode, street_address, bedrooms, bathrooms, car_spaces, land_area_sqm, asking_price, price_display, indicative_weekly_rent, development_idea, risk_flags, lifestyle_tags, illustration_seed, provenance, listed_on";

export type Kind = Listing["kind"];
export type Market = Listing["market"];
export type Decision = "save" | "pass";

export const KIND_LABEL: Record<Kind, string> = { home: "Find My Home", investment: "Find My Investment" };
export const MARKET_LABEL: Record<Market, string> = { for_sale: "For Sale", off_market: "Off-Market Potential" };
