import { describe, expect, it } from "vitest";
import { annualised, buildTypeProfile, changeOver, grossYield, marketSummary, pointMonthsBefore, sampleNote, type SalesPoint } from "./stats";

const month = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-28`;
// Monthly rolling medians: 500k in Sep 2021 growing to 800k by Sep 2026.
const series: SalesPoint[] = [];
for (let i = 0; i <= 60; i++) {
  const y = 2021 + Math.floor((8 + i) / 12);
  const m = ((8 + i) % 12) + 1;
  series.push({ periodEnd: month(y, m), median: Math.round(500_000 * (800 / 500) ** (i / 60)), count: 20 + (i % 5) });
}

describe("suburb statistics", () => {
  it("finds the point a given number of months before the latest", () => {
    expect(pointMonthsBefore(series, 12)?.periodEnd).toBe("2025-09-28");
    expect(pointMonthsBefore(series, 120)).toBeNull();
  });

  it("calculates the 12-month change from the actual medians, with counts", () => {
    const c = changeOver(series, 12)!;
    expect(c.to).toBe(800_000);
    expect(c.change).toBeCloseTo(800_000 / c.from - 1, 10);
    expect(c.toCount).toBe(series.at(-1)!.count);
  });

  it("annualises growth over several years", () => {
    expect(annualised(series, 5)!.perYear).toBeCloseTo((800 / 500) ** (1 / 5) - 1, 6);
    expect(annualised(series, 10)).toBeNull(); // not enough history
  });

  it("never hides a figure for a small sample; it labels it", () => {
    const tiny: SalesPoint[] = [
      { periodEnd: "2025-09-30", median: 550_000, count: 3 },
      { periodEnd: "2026-09-30", median: 705_100, count: 4 },
    ];
    const c = changeOver(tiny, 12)!;
    expect(c.change).toBeCloseTo(0.282, 3);
    expect(sampleNote(4)).toEqual({ label: "Based on 4 sales: a very small sample", level: "very_small" });
    expect(sampleNote(9).level).toBe("small");
    expect(sampleNote(46)).toEqual({ label: "Based on 46 sales", level: "ok" });
    expect(sampleNote(0).level).toBe("none");
  });

  it("returns no change when either period had no sales", () => {
    expect(changeOver([{ periodEnd: "2025-09-30", median: null, count: 0 }, { periodEnd: "2026-09-30", median: 600_000, count: 2 }], 12)).toBeNull();
  });

  it("calculates gross yield and builds a type profile", () => {
    expect(grossYield(800, 1_100_000)).toBeCloseTo(0.0378, 4);
    expect(grossYield(null, 1_100_000)).toBeNull();
    const p = buildTypeProfile("house", series, [{ periodEnd: "2026-09-30", medianWeekly: 650, count: 30 }], [{ bedrooms: 4, median: 900_000, count: 8 }, { bedrooms: 3, median: 700_000, count: 12 }]);
    expect(p.median?.median).toBe(800_000);
    expect(p.growth.map((g) => g.years)).toEqual([1, 3, 5]);
    expect(p.trend).toHaveLength(61);
    expect(p.yield).toBeCloseTo((650 * 52) / 800_000, 6);
    expect(p.bedrooms.map((b) => b.bedrooms)).toEqual([3, 4]);
  });

  it("writes the market summary only from the figures, with sale counts", () => {
    const house = buildTypeProfile("house", series, [{ periodEnd: "2026-09-30", medianWeekly: 650, count: 30 }], []);
    const unit = buildTypeProfile("unit", [{ periodEnd: "2025-09-30", median: 550_000, count: 3 }, { periodEnd: "2026-09-30", median: 705_100, count: 4 }], [], []);
    const s = marketSummary("Testville", [house, unit]);
    expect(s).toMatch(/^Over the past 12 months, median sale prices in Testville were \$800,000 for houses \(\d+ sales\) and \$705,100 for units \(4 sales\)\./);
    expect(s).toContain("The units median is up 28.2% on the previous 12 months (4 sales this year, 3 the year before).");
    expect(s).toContain("Median rents are $650 a week for houses (gross yield 4.2%).");
    expect(s).toMatch(/Past growth doesn't predict future growth\.$/);
  });
});
