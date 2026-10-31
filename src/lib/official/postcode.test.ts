import { describe, expect, it } from "vitest";
import { buildOfficialProfile, countText, type OfficialRow } from "./postcode";

const base = { source_url: "https://dcj.nsw.gov.au/x.xlsx", retrieved_at: "2026-10-31T00:00:00Z", change_quarterly: null } as const;
const sale = (end: string, category: string, median: number | null, count: number | null, note: OfficialRow["count_note"] = "exact", change: number | null = null): OfficialRow => ({
  ...base, dataset: "nsw_dcj_sales", category, dwelling_type: category === "Strata" ? "unit" : "house", bedrooms: "Total",
  period_start: `${end.slice(0, 5)}01-01`, period_end: end, median, count, count_note: note, change_annual: change,
});
const rent = (type: string, bedrooms: string, median: number | null, count: number | null, note: OfficialRow["count_note"] = "exact"): OfficialRow => ({
  ...base, dataset: "nsw_dcj_rent", category: type, dwelling_type: type, bedrooms, period_start: "2026-04-01", period_end: "2026-06-30", median, count, count_note: note, change_annual: 0.04,
});

// Wyee's postcode as published (houses, March quarters) plus a suppressed units quarter.
const rows: OfficialRow[] = [
  sale("2021-03-31", "Non Strata", 600_000, 210),
  sale("2023-03-31", "Non Strata", 720_000, 230),
  sale("2026-03-31", "Non Strata", 960_000, 252, "exact", 0.1294),
  sale("2026-03-31", "Strata", 710_000, null, "30_or_fewer", 0.1707),
  sale("2025-12-31", "Strata", null, null, "10_or_fewer"),
  rent("house", "Total", 700, 417),
  rent("house", "3 Bedrooms", 650, 142),
  rent("house", "Not Specified", null, null, "10_or_fewer"),
  rent("unit", "Total", 480, null, "30_or_fewer"),
];

describe("official NSW postcode profile", () => {
  const p = buildOfficialProfile("2259", rows)!;

  it("uses the latest published quarter and DCJ's own annual change", () => {
    expect(p.house.latest).toMatchObject({ median: 960_000, count: 252, countNote: "exact", periodEnd: "2026-03-31" });
    expect(p.house.changeAnnual).toBe(0.1294);
    expect(p.unit.latest).toMatchObject({ median: 710_000, count: null, countNote: "30_or_fewer" });
  });

  it("calculates 3- and 5-year growth from published medians for the same quarter", () => {
    expect(p.house.growth.map((g) => g.years)).toEqual([3, 5]);
    expect(p.house.growth[1]!.perYear).toBeCloseTo((960 / 600) ** (1 / 5) - 1, 8);
    expect(p.unit.growth).toEqual([]); // no published unit median 3 or 5 years earlier
  });

  it("keeps suppressed figures as not published, and drops a published $0", () => {
    expect(p.unit.trend.find((t) => t.periodEnd === "2025-12-31")).toMatchObject({ median: null, countNote: "10_or_fewer" });
    const zero = buildOfficialProfile("2460", [rent("house", "Total", 0, 36)])!;
    expect(zero.house.rent?.median).toBeNull();
  });

  it("rents, bedrooms and yield (rent × 52 ÷ median price)", () => {
    expect(p.house.rent).toMatchObject({ median: 700, count: 417, changeAnnual: 0.04 });
    expect(p.house.rentByBedrooms.map((b) => b.bedrooms)).toEqual(["3 Bedrooms"]);
    expect(p.house.yield).toBeCloseTo((700 * 52) / 960_000, 8);
  });

  it("describes counts the way DCJ publishes them", () => {
    expect(countText({ count: 252, countNote: "exact" })).toBe("252 sales");
    expect(countText({ count: null, countNote: "30_or_fewer" })).toBe("30 or fewer sales");
    expect(countText({ count: null, countNote: "10_or_fewer" })).toBe("10 or fewer sales");
  });
});

describe("official summary", async () => {
  const { officialSummary } = await import("./postcode");
  it("is written only from the published figures", () => {
    const s = officialSummary(buildOfficialProfile("2259", rows)!);
    expect(s).toContain("In the Jan–Mar 2026 quarter, the median sale price for houses (non-strata) in postcode 2259 was $960,000 (252 sales), up 12.9% on a year earlier.");
    expect(s).toContain("Median weekly rent for new house bonds was $700.");
    expect(s).toContain("units and townhouses (strata) in postcode 2259 was $710,000 (30 or fewer sales), up 17.1% on a year earlier.");
  });
});
