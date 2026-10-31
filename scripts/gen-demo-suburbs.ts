/**
 * Generates the DEMO suburb statistics block in supabase/seed.sql (deterministic).
 *
 *   npx tsx scripts/gen-demo-suburbs.ts
 *
 * Fictional figures for the demo towns so suburb profiles can be built and tested before real data
 * (NSW Valuer General sales, NSW Rent and Sales Report) is loaded. Every row is is_demo and labelled
 * "SitePilot DEMO suburb statistics (fictional)"; they describe no real market. Some unit series have
 * very few sales on purpose, to exercise the sample-size notes.
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
const BASE: Record<State, number> = { NSW: 940_000, VIC: 780_000, QLD: 690_000, WA: 650_000, SA: 620_000, TAS: 560_000, ACT: 820_000, NT: 520_000 };
const SOURCE = "SitePilot DEMO suburb statistics (fictional)";
const END = { y: 2026, m: 9 }; // September 2026
const MONTHS = 61; // Sep 2021 → Sep 2026

// Small deterministic PRNG per series.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const r5 = (n: number) => Math.round(n / 500) * 500;

const sales: string[] = [];
const rents: string[] = [];
for (const state of Object.keys(SUBURBS) as State[]) {
  for (const [suburb, postcode] of SUBURBS[state]) {
    for (const type of ["house", "unit"] as const) {
      const rand = rng(`${state}/${suburb}/${type}`);
      const start = BASE[state] * (type === "house" ? 0.55 + rand() * 0.3 : 0.38 + rand() * 0.22);
      const annual = -0.02 + rand() * 0.13; // -2% to 11% a year, fictional
      const sparse = type === "unit" && rand() < 0.35; // a few towns with very few unit sales
      const baseCount = type === "house" ? 20 + Math.floor(rand() * 60) : sparse ? 2 + Math.floor(rand() * 4) : 8 + Math.floor(rand() * 30);
      let median = start;
      for (let i = 0; i < MONTHS; i++) {
        const k = END.y * 12 + (END.m - 1) - (MONTHS - 1 - i);
        const y = Math.floor(k / 12);
        const m = (k % 12) + 1;
        median *= (1 + annual) ** (1 / 12) * (1 + (rand() - 0.5) * (sparse ? 0.08 : 0.02));
        const count = Math.max(0, baseCount + Math.round((rand() - 0.5) * baseCount * 0.4));
        sales.push(`  (${q(state)}, ${q(suburb)}, ${q(postcode)}, '${type}', null, '${monthEnd(y, m)}', 12, ${count ? r5(median) : "null"}, ${count}, ${q(SOURCE)}, 'estimated', true)`);
      }
      // Latest bedroom breakdown (rolling 12 months to September 2026).
      const beds = type === "house" ? [2, 3, 4, 5] : [1, 2, 3];
      const mult = type === "house" ? [0.8, 0.95, 1.12, 1.35] : [0.72, 1, 1.3];
      beds.forEach((b, j) => {
        const share = type === "house" ? [0.1, 0.4, 0.38, 0.12][j]! : [0.2, 0.6, 0.2][j]!;
        const count = Math.round(baseCount * share * (0.6 + rand() * 0.8));
        sales.push(`  (${q(state)}, ${q(suburb)}, ${q(postcode)}, '${type}', ${b}, '${monthEnd(END.y, END.m)}', 12, ${count ? r5(median * mult[j]! * (0.95 + rand() * 0.1)) : "null"}, ${count}, ${q(SOURCE)}, 'estimated', true)`);
      });
      // Quarterly median rents for the last two years.
      const yieldPct = (type === "house" ? 0.034 : 0.042) + rand() * 0.015;
      for (let qtr = 7; qtr >= 0; qtr--) {
        const k = END.y * 12 + (END.m - 1) - qtr * 3;
        const y = Math.floor(k / 12);
        const m = (k % 12) + 1;
        const bonds = Math.max(0, Math.round(baseCount * 0.6 * (0.7 + rand() * 0.6)));
        const rent = Math.round(((median / (1 + annual) ** (qtr / 4)) * yieldPct) / 52 / 10) * 10;
        rents.push(`  (${q(state)}, ${q(suburb)}, ${q(postcode)}, '${type}', null, '${monthEnd(y, m)}', ${bonds ? rent : "null"}, ${bonds}, ${q(SOURCE)}, 'estimated', true)`);
      }
    }
  }
}

const BEGIN = "-- BEGIN GENERATED DEMO SUBURB STATS (scripts/gen-demo-suburbs.ts)";
const ENDM = "-- END GENERATED DEMO SUBURB STATS";
const block = `${BEGIN}
-- Fictional suburb statistics for the demo towns. Not real market data.
insert into public.suburb_sales_stats (state, suburb, postcode, dwelling_type, bedrooms, period_end, window_months, median_price, sales_count, source, status, is_demo) values
${sales.join(",\n")};
insert into public.suburb_rent_stats (state, suburb, postcode, dwelling_type, bedrooms, period_end, median_rent_weekly, bonds_count, source, status, is_demo) values
${rents.join(",\n")};
${ENDM}`;
const seedPath = path.resolve(__dirname, "../supabase/seed.sql");
const seed = readFileSync(seedPath, "utf8");
const s = seed.indexOf(BEGIN);
const e = seed.indexOf(ENDM);
writeFileSync(seedPath, s === -1 ? `${seed.trimEnd()}\n\n${block}\n` : `${seed.slice(0, s)}${block}${seed.slice(e + ENDM.length)}`);
console.log(`wrote ${sales.length} sales rows and ${rents.length} rent rows`);
