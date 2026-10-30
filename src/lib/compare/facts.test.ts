import { describe, expect, it } from "vitest";
import { dutyBracketsSchema, dutyFromBrackets } from "./duty";
import { factsFor, type CompareListing, type Estimate } from "./facts";

// A synthetic bracket table for testing the arithmetic only (not any state's real rates).
const BRACKETS = [
  { from: 0, base: 0, ratePer100: 1 },
  { from: 100_000, base: 1_000, ratePer100: 3 },
  { from: 500_000, base: 13_000, ratePer100: 5 },
];

describe("dutyFromBrackets", () => {
  it("applies the highest bracket reached", () => {
    expect(dutyFromBrackets(BRACKETS, 50_000)).toBe(500);
    expect(dutyFromBrackets(BRACKETS, 100_000)).toBe(1_000);
    expect(dutyFromBrackets(BRACKETS, 300_000)).toBe(7_000);
    expect(dutyFromBrackets(BRACKETS, 600_000)).toBe(18_000);
    expect(dutyFromBrackets(BRACKETS, 0)).toBe(0);
  });
  it("rejects malformed tables", () => {
    expect(dutyBracketsSchema.safeParse(BRACKETS).success).toBe(true);
    expect(dutyBracketsSchema.safeParse([{ from: 10, base: 0, ratePer100: 1 }]).success).toBe(false);
    expect(dutyBracketsSchema.safeParse([BRACKETS[1], BRACKETS[0]]).success).toBe(false);
  });
});

const listing = (over: Partial<CompareListing> = {}): CompareListing =>
  ({
    id: "l1",
    kind: "investment",
    market: "for_sale",
    is_demo: true,
    headline: "Test",
    property_type: "house",
    state: "NSW",
    bedrooms: 3,
    land_area_sqm: 500,
    asking_price: 700_000,
    indicative_weekly_rent: 600,
    risk_flags: ["Check flood mapping"],
    property_record_id: "r1",
    ...over,
  }) as CompareListing;
const estimate: Estimate = {
  value_low: 650_000,
  value_mid: 720_000,
  value_high: 780_000,
  rent_weekly_low: 550,
  rent_weekly_mid: 610,
  rent_weekly_high: 670,
  confidence: "medium",
  source: "SitePilot DEMO estimate (fictional)",
  as_of: "2026-10-30",
  is_demo: true,
};
const duty = { state: "NSW", version: "test", brackets: BRACKETS, source_url: "https://example.invalid", as_of: "2026-07-01", status: "needs_review" as const };

describe("factsFor", () => {
  it("prefers listing figures, and uses the duty preset", () => {
    const { facts } = factsFor(listing(), estimate, duty);
    expect(facts).toMatchObject({ price: 700_000, priceSource: "listing", weeklyRent: 600, rentSource: "listing", stampDuty: 23_000, openChecks: 1, completeness: 1 });
  });
  it("off-market homes use the estimated value, never an asking price", () => {
    const { facts } = factsFor(listing({ market: "off_market", asking_price: null, indicative_weekly_rent: null }), estimate, duty);
    expect(facts).toMatchObject({ price: 720_000, priceSource: "estimate", weeklyRent: 610, rentSource: "estimate" });
  });
  it("missing data stays null, and lowers completeness", () => {
    const { facts } = factsFor(listing({ market: "off_market", asking_price: null, indicative_weekly_rent: null }), null, null);
    expect(facts).toMatchObject({ price: null, priceSource: null, weeklyRent: null, stampDuty: null });
    expect(facts.completeness).toBeCloseTo(2 / 6);
  });
  it("ignores a malformed duty preset", () => {
    expect(factsFor(listing(), estimate, { ...duty, brackets: [{ nope: 1 }] }).facts.stampDuty).toBeNull();
  });
});

describe("formatAudCompact", async () => {
  const { formatAudCompact } = await import("@/lib/format");
  it("is deterministic across ICU builds", () => {
    expect(formatAudCompact(-25_000)).toBe("−$25K");
    expect(formatAudCompact(1_250_000)).toBe("$1.3M");
    expect(formatAudCompact(1_000_000)).toBe("$1M");
    expect(formatAudCompact(950)).toBe("$950");
  });
});

describe("assessDevelopment", async () => {
  const { assessDevelopment } = await import("./development");
  const { EMPTY_ASSUMPTIONS } = await import("@/lib/finance/assumptions");
  const complete = {
    ...EMPTY_ASSUMPTIONS,
    land: { basis: "purchase_price" as const, amount: 1_000_000 },
    hard: { demolition: 0, siteWorks: 0, construction: 500_000, infrastructure: 0 },
    sale: { grossRealisation: 1_800_000, sellingCostsPct: 0 },
  };
  const verified = { source_type: "planning_certificate", verification_status: "verified", is_demo: false };
  const scen = (a: unknown, updated = "2026-10-30T00:00:00Z") => ({ id: "s1", name: "Duplex", assumptions_json: a, updated_at: updated });

  it("scores only with verified official evidence and a complete scenario", () => {
    const d = assessDevelopment("w1", [verified], [scen(complete)]);
    expect(d.missing).toEqual([]);
    expect(d.roi).toBeCloseTo(0.2, 6); // (1.8m − 1.5m) ÷ 1.5m
  });
  it("explains what's missing", () => {
    expect(assessDevelopment("w1", [], []).missing).toEqual([
      "verify an official planning record (e.g. a planning certificate) in the workspace",
      "add a develop-and-sell scenario",
    ]);
    const starter = assessDevelopment("w1", [verified], [scen({ ...EMPTY_ASSUMPTIONS, land: { basis: "purchase_price", amount: 900_000 } })]);
    expect(starter.roi).toBeNull();
    expect(starter.missing).toEqual(["finish the scenario: add build costs and an assumed sale value"]);
  });
  it("ignores unverified, DEMO and non-planning evidence", () => {
    const ev = [
      { ...verified, verification_status: "unverified" },
      { ...verified, is_demo: true },
      { source_type: "title_search", verification_status: "verified", is_demo: false },
    ];
    expect(assessDevelopment("w1", ev, [scen(complete)]).roi).toBeNull();
  });
  it("uses the latest develop-and-sell scenario and skips retain-and-rent or invalid ones", () => {
    const rent = { ...complete, strategy: "retain_and_rent" };
    const d = assessDevelopment("w1", [verified], [scen(complete, "2026-10-01T00:00:00Z"), scen(rent, "2026-10-30T00:00:00Z"), scen({ nope: 1 }, "2026-10-31T00:00:00Z")]);
    expect(d.scenario?.complete).toBe(true);
  });
});

describe("duty preset file", async () => {
  const { dutyPresetFileSchema } = await import("./duty-presets");
  const ok = { state: "NSW", version: "2026-07", brackets: [{ from: 0, base: 0, ratePer100: 1.25 }], source_url: "https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty", as_of: "2026-07-01" };
  it("accepts an official source and defaults to needs_review", () => {
    const r = dutyPresetFileSchema.safeParse([ok]);
    expect(r.success && r.data[0]!.status).toBe("needs_review");
  });
  it("rejects other websites, plain http, bad brackets and inconsistent review fields", () => {
    for (const bad of [
      { ...ok, source_url: "https://www.example.com/nsw-duty" },
      { ...ok, source_url: "https://www.sro.vic.gov.au/rates" }, // another state's site
      { ...ok, source_url: "http://www.revenue.nsw.gov.au/x" },
      { ...ok, brackets: [{ from: 100, base: 0, ratePer100: 1 }] },
      { ...ok, status: "reviewed" },
      { ...ok, reviewed_by: "Someone", reviewed_at: "2026-10-30T00:00:00Z" },
    ]) {
      expect(dutyPresetFileSchema.safeParse([bad]).success, JSON.stringify(bad)).toBe(false);
    }
    expect(dutyPresetFileSchema.safeParse([{ ...ok, status: "reviewed", reviewed_by: "A. Accountant", reviewed_at: "2026-10-30T00:00:00Z" }]).success).toBe(true);
  });
  it("rejects duplicate state versions", () => {
    expect(dutyPresetFileSchema.safeParse([ok, ok]).success).toBe(false);
  });
});
