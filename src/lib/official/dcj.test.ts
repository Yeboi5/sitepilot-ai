import { describe, expect, it } from "vitest";
import { num, parsePeriod, parsePostcodeSheet, pct } from "./dcj";

// Rows copied from the published March 2026 sales and June 2026 rent tables (layout as published).
const SALES = [
  ["Table 4. Sale prices statistics by NSW Postcode"],
  ["Reporting period: January - March 2026"],
  ["(s): 30 or fewer properties sold; (-): 10 or fewer properties sold"],
  [],
  ["Postcode", "Dwelling Type", "First Quartile Sales Price\n$'000s", "Median Sales Price\n$'000s", "Third Quartile Sales Price\n'000s", "Mean Sales Price\n$'000s", "Sales\nNo.", "Qtly change in Median", "Annual change in Median", "Qtly change in Count", "Annual change in Count"],
  [2000, "Total", "785", "1050", "1860", "1479", "147", "-9.68%", "-11.05%", "-30.00%", "-25.76%"],
  [2000, "Non Strata", "-", "-", "-", "-", "-", "-", "-", "-", "-"],
  [2007, "Strata", "470", "870", "1075", "808", "s", "12.99%", "22.97%", "-7.84%", "30.56%"],
];
const RENT = [
  ["Table 2. Weekly rents statistics by NSW Postcode"],
  ["Reporting period: April to June 2026"],
  [],
  ["Postcode", "Dwelling Types", "Number of Bedrooms", "First Quartile Weekly Rent for New Bonds\n$", "Median Weekly Rent for New Bonds\n$", "Third Quartile Weekly Rent for New Bonds\n$", "New Bonds Lodged\nNo.", "Total Bonds Held\nNo.", "Quarterly change in Median Weekly Rent", "Annual change in Median Weekly Rent", "Quarterly change in New Bonds Lodged", "Annual change in New Bonds Lodged"],
  [2000, "Total", "Total", "850", "1100", "1420", "972", "11,316", "18.28%", "4.76%", "-48.76%", "-1.62%"],
  [2000, "House", "3 Bedrooms", "900", "1000", "1100", "-", "40", "-", "-", "-", "-"],
];

describe("NSW Rent and Sales Report parser", () => {
  it("reads reporting periods", () => {
    expect(parsePeriod("Reporting period: January - March 2026")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(parsePeriod("Reporting period: April to June 2026")).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    expect(parsePeriod("nothing here")).toBeNull();
  });

  it("parses published numbers and percentages; dashes and 's' are not numbers", () => {
    expect(num("1,050", 1000)).toBe(1_050_000);
    expect(num("-")).toBeNull();
    expect(num("s")).toBeNull();
    expect(pct("-9.68%")).toBe(-0.0968);
    expect(pct(".00%")).toBe(0);
    expect(pct("-")).toBeNull();
  });

  it("parses sales: $'000 to dollars, categories mapped, suppression kept exactly", () => {
    const { records, period } = parsePostcodeSheet(SALES, "nsw_dcj_sales");
    expect(period.end).toBe("2026-03-31");
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ areaCode: "2000", category: "Total", dwellingType: "all", median: 1_050_000, count: 147, countNote: "exact", changeAnnual: -0.1105 });
    expect(records[1]).toMatchObject({ category: "Non Strata", dwellingType: "house", median: null, count: null, countNote: "10_or_fewer" });
    expect(records[2]).toMatchObject({ category: "Strata", dwellingType: "unit", median: 870_000, count: null, countNote: "30_or_fewer", changeAnnual: 0.2297 });
  });

  it("parses rents with bedrooms and bonds held", () => {
    const { records } = parsePostcodeSheet(RENT, "nsw_dcj_rent");
    expect(records[0]).toMatchObject({ areaCode: "2000", dwellingType: "all", bedrooms: "Total", median: 1100, count: 972, bondsHeld: 11_316, changeAnnual: 0.0476 });
    expect(records[1]).toMatchObject({ dwellingType: "house", bedrooms: "3 Bedrooms", median: null, countNote: "10_or_fewer", bondsHeld: 40 });
  });

  it("refuses sheets it doesn't understand", () => {
    expect(() => parsePostcodeSheet([["Reporting period: January - March 2026"], ["a", "b"]], "nsw_dcj_sales")).toThrow(/layout/);
    expect(() => parsePostcodeSheet([["Postcode"]], "nsw_dcj_sales")).toThrow(/period/);
  });
});
