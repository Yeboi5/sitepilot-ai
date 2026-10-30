/**
 * Generates the synthetic DEMO listings block in supabase/seed.sql (deterministic).
 *
 *   npx tsx scripts/gen-demo-listings.ts
 *
 * Rules (Master Blueprint v2.0 §3, §9):
 * - Everything is fictional and flagged is_demo. Suburbs are real so the nationwide UI is
 *   realistic; street addresses are obviously fictional ("[DEMO] … Example Lane").
 * - Prices and rents are illustrative, not market data, and are labelled as such in the UI.
 * - Off-market rows are NOT FOR SALE: no price and no street address (enforced by constraints).
 * - Tags describe the fictional home itself, never claims about the real suburb.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type State = "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";

const SUBURBS: Record<State, [string, string][]> = {
  NSW: [["Halekulani", "2262"], ["Parramatta", "2150"], ["Newcastle", "2300"], ["Wollongong", "2500"], ["Orange", "2800"], ["Tamworth", "2340"]],
  VIC: [["Ballarat", "3350"], ["Geelong", "3220"], ["Brunswick", "3056"], ["Bendigo", "3550"], ["Frankston", "3199"], ["Shepparton", "3630"]],
  QLD: [["Townsville", "4810"], ["Toowoomba", "4350"], ["Southport", "4215"], ["Cairns", "4870"], ["Ipswich", "4305"], ["Mackay", "4740"]],
  WA: [["Fremantle", "6160"], ["Joondalup", "6027"], ["Bunbury", "6230"], ["Midland", "6056"], ["Geraldton", "6530"], ["Mandurah", "6210"]],
  SA: [["Glenelg", "5045"], ["Mount Barker", "5251"], ["Elizabeth", "5112"], ["Port Lincoln", "5606"], ["Norwood", "5067"], ["Murray Bridge", "5253"]],
  TAS: [["Launceston", "7250"], ["Sandy Bay", "7005"], ["Devonport", "7310"], ["Kingston", "7050"], ["Burnie", "7320"], ["Glenorchy", "7010"]],
  ACT: [["Belconnen", "2617"], ["Tuggeranong", "2900"], ["Gungahlin", "2912"], ["Kingston", "2604"], ["Weston", "2611"], ["Bruce", "2617"]],
  NT: [["Darwin City", "0800"], ["Palmerston", "0830"], ["Alice Springs", "0870"], ["Nightcliff", "0810"], ["Katherine", "0850"], ["Stuart Park", "0820"]],
};

// Illustrative base price per state (not market data).
const BASE: Record<State, number> = { NSW: 940_000, VIC: 780_000, QLD: 690_000, WA: 650_000, SA: 620_000, TAS: 560_000, ACT: 820_000, NT: 520_000 };

const HOME_TAGS = [
  ["North-facing backyard", "Renovated kitchen", "Walk to shops"],
  ["Open-plan living", "Solar panels", "Room for a veggie patch"],
  ["Quiet street", "Second living area", "Off-street parking"],
  ["Big windows, lots of light", "Covered deck", "Low-maintenance garden"],
  ["Home office nook", "Ducted heating and cooling", "Pet-friendly yard"],
  ["Character features", "High ceilings", "Established trees"],
];
const BUILT_IDEAS = [
  "Granny flat concept: check council rules for secondary dwellings",
  "Renovate and rent: kitchen and bathroom refresh",
  "Duplex rebuild concept: needs planning advice",
  "Add a bedroom: extension concept",
  "Cosmetic refresh and re-lease",
];
const APARTMENT_IDEAS = ["Renovate and rent: kitchen and bathroom refresh", "Cosmetic refresh and re-lease"];
const LAND_IDEAS = [
  "New home build concept: check council rules",
  "Subdivision concept: lot size and zoning must be checked",
];
const ideaFor = (type: string, k: number) => {
  const pool = type === "land" ? LAND_IDEAS : type === "apartment" ? APARTMENT_IDEAS : BUILT_IDEAS;
  return pool[k % pool.length]!;
};

const RISKS = [
  ["Older wiring: building inspection advised"],
  ["Possible flood overlay: check council mapping"],
  ["Strata levies unknown: request records"],
  ["Bushfire-prone area? Check state mapping"],
  ["Heritage controls may apply: check with council"],
  ["Tenanted: confirm lease terms"],
];
const TYPES = ["house", "townhouse", "apartment", "duplex", "land"] as const;

const states = Object.keys(SUBURBS) as State[];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]) => (a.length ? `array[${a.map(q).join(", ")}]` : "'{}'::text[]");
const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Row = Record<string, string>;
const records: Row[] = [];
const listings: Row[] = [];
let n = 0;

// Per state: 2 home for sale, 1 home off-market, 2 investment for sale, 1 investment off-market.
const PLAN = [
  ["home", "for_sale"],
  ["home", "for_sale"],
  ["home", "off_market"],
  ["investment", "for_sale"],
  ["investment", "for_sale"],
  ["investment", "off_market"],
] as const;

states.forEach((state, si) => {
  PLAN.forEach(([kind, market], i) => {
    n += 1;
    const [suburb, postcode] = SUBURBS[state][i]!;
    const type = kind === "home" ? TYPES[(si + i) % 4]! : TYPES[(si + i) % 5]!;
    const beds = type === "land" ? 0 : type === "apartment" ? 2 : 2 + ((si + i) % 3);
    const baths = type === "land" ? 0 : 1 + ((si + i) % 2);
    const cars = type === "land" ? 0 : type === "apartment" ? 1 : 1 + ((si * 3 + i) % 2);
    const land = type === "apartment" ? null : 280 + ((si * 97 + i * 53) % 520);
    const price = Math.round((BASE[state] * (0.8 + 0.12 * beds + ((si + i) % 3) * 0.05)) / 5000) * 5000;
    const forSale = market === "for_sale";
    const street = forSale ? `[DEMO] ${10 + n} Example Lane` : null;
    const yieldPct = 0.034 + ((si * 7 + i * 3) % 25) / 1000; // 3.4%–5.8%, illustrative
    // Rent assumptions only for for-sale, built investment listings (none for land, and none for
    // off-market homes, so nothing implies knowledge of a real owner's property).
    const rent = kind === "investment" && forSale && type !== "land" ? Math.round((price * yieldPct) / 52 / 10) * 10 : null;
    const idea = ideaFor(type, si + i);
    const recordId = id("31000000", n);
    const listingId = id("30000000", n);
    const label = type === "land" ? "land" : `${beds}-bedroom ${type}`;
    const headline =
      kind === "home"
        ? forSale
          ? `Sunny ${label} in ${suburb}`
          : `${suburb} ${label} with potential`
        : forSale
          ? `${suburb} ${label}: ${idea.split(":")[0]!.toLowerCase()}`
          : `Off-market potential: ${suburb} ${type}`;
    const description = forSale
      ? `A fictional ${label} created for SitePilot's demo. The price and details are illustrative only and do not describe a real property.`
      : `A fictional ${type} shown to illustrate off-market screening. It is NOT FOR SALE, and nothing suggests the owner wants to sell.`;

    records.push({
      id: q(recordId),
      state: q(state),
      suburb: q(suburb),
      postcode: q(postcode),
      street_address: street ? q(street) : "null",
      source: q("demo"),
      is_demo: "true",
    });
    listings.push({
      id: q(listingId),
      property_record_id: q(recordId),
      kind: q(kind),
      market: q(market),
      is_demo: "true",
      headline: q(headline),
      description: q(description),
      property_type: q(type),
      state: q(state),
      suburb: q(suburb),
      postcode: q(postcode),
      street_address: street ? q(street) : "null",
      bedrooms: String(beds),
      bathrooms: String(baths),
      car_spaces: String(cars),
      land_area_sqm: land ? String(land) : "null",
      asking_price: forSale ? String(price) : "null",
      price_display: forSale ? q(`$${price.toLocaleString("en-AU")}`) : "null",
      indicative_weekly_rent: rent ? String(rent) : "null",
      development_idea: kind === "investment" ? q(idea) : "null",
      risk_flags: kind === "investment" ? arr(RISKS[(si + i) % RISKS.length]!) : "'{}'::text[]",
      lifestyle_tags: kind === "home" ? arr(HOME_TAGS[(si + i) % HOME_TAGS.length]!) : "'{}'::text[]",
      illustration_seed: String(n * 37),
      provenance: q(
        JSON.stringify({ source: "SitePilot synthetic demo data", licence: "fictional, no third-party data", as_of: "2026-10-30", verification: "unverified" }),
      ),
      listed_on: forSale ? q(`2026-10-${String(1 + ((n * 3) % 28)).padStart(2, "0")}`) : "null",
    });
  });
});

function insert(table: string, rows: Row[]) {
  const cols = Object.keys(rows[0]!);
  return `insert into public.${table} (${cols.join(", ")}) values\n${rows.map((r) => `  (${cols.map((c) => r[c]).join(", ")})`).join(",\n")};\n`;
}

const BEGIN = "-- BEGIN GENERATED DEMO LISTINGS (scripts/gen-demo-listings.ts)";
const END = "-- END GENERATED DEMO LISTINGS";
const block = `${BEGIN}
-- ${listings.length} fictional listings across all states and territories. Illustrative only.
${insert("property_records", records)}
${insert("listings", listings)}${END}`;

const seedPath = path.resolve(__dirname, "../supabase/seed.sql");
const seed = readFileSync(seedPath, "utf8");
// Replace by position (the markers contain regex metacharacters).
const start = seed.indexOf(BEGIN);
const end = seed.indexOf(END);
const next =
  start === -1 ? `${seed.trimEnd()}\n\n${block}\n` : `${seed.slice(0, start)}${block}${seed.slice(end + END.length)}`;
writeFileSync(seedPath, next);
console.log(`wrote ${listings.length} demo listings to supabase/seed.sql`);
