import { formatAud, formatRatio } from "@/lib/format";

/**
 * Suburb profile statistics (INTELLIGENCE_UPGRADE_PLAN.md §7). Pure and deterministic.
 * Figures are always calculated from the actual change, whatever the number of sales, and every
 * figure travels with the counts behind it so the UI and Compare can say how much evidence there is.
 * Growth is historical, never a forecast. See docs/FORMULAS.md → suburb-stats-1.0.0.
 */
export const SUBURB_STATS_VERSION = "suburb-stats-1.0.0";

export type DwellingType = "house" | "unit";
/** One rolling-window observation: the median of sales in the window ending on periodEnd. */
export type SalesPoint = { periodEnd: string; median: number | null; count: number };
export type RentPoint = { periodEnd: string; medianWeekly: number | null; count: number };

export type Change = { from: number; to: number; change: number; fromCount: number; toCount: number; fromPeriod: string; toPeriod: string };

const monthKey = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return y! * 12 + (m! - 1);
};

export function latest<T extends { periodEnd: string }>(series: T[]): T | null {
  return series.length ? series.reduce((a, b) => (b.periodEnd > a.periodEnd ? b : a)) : null;
}

/** The point whose period ends `months` before the latest one (same calendar month). */
export function pointMonthsBefore(series: SalesPoint[], months: number): SalesPoint | null {
  const last = latest(series);
  if (!last) return null;
  const target = monthKey(last.periodEnd) - months;
  return series.find((p) => monthKey(p.periodEnd) === target) ?? null;
}

/** Change in the median between the latest window and the one `months` earlier. */
export function changeOver(series: SalesPoint[], months: number): Change | null {
  const to = latest(series);
  const from = pointMonthsBefore(series, months);
  if (!to || !from || to.median == null || from.median == null || from.median <= 0) return null;
  return { from: from.median, to: to.median, change: to.median / from.median - 1, fromCount: from.count, toCount: to.count, fromPeriod: from.periodEnd, toPeriod: to.periodEnd };
}

/** Compound annual growth over `years` (historical). */
export function annualised(series: SalesPoint[], years: number): (Change & { perYear: number; years: number }) | null {
  const c = changeOver(series, years * 12);
  return c ? { ...c, years, perYear: (c.to / c.from) ** (1 / years) - 1 } : null;
}

export function grossYield(medianRentWeekly: number | null | undefined, medianPrice: number | null | undefined): number | null {
  if (!medianRentWeekly || !medianPrice) return null;
  return (medianRentWeekly * 52) / medianPrice;
}

/** A plain label for how much evidence a figure rests on. Informational only: nothing is hidden. */
export function sampleNote(count: number): { label: string; level: "none" | "very_small" | "small" | "ok" } {
  if (count === 0) return { label: "No sales in this period", level: "none" };
  if (count < 5) return { label: `Based on ${count} sale${count === 1 ? "" : "s"}: a very small sample`, level: "very_small" };
  if (count < 12) return { label: `Based on ${count} sales: a small sample`, level: "small" };
  return { label: `Based on ${count} sales`, level: "ok" };
}

export type TypeProfile = {
  type: DwellingType;
  median: SalesPoint | null;
  change12: Change | null;
  growth: { years: number; perYear: number; from: number; to: number; fromCount: number; toCount: number }[];
  trend: SalesPoint[]; // last 5 years of rolling medians, ascending
  rent: RentPoint | null;
  yield: number | null;
  bedrooms: { bedrooms: number; median: number | null; count: number }[];
};

export function buildTypeProfile(type: DwellingType, series: SalesPoint[], rent: RentPoint[], bedrooms: { bedrooms: number; median: number | null; count: number }[]): TypeProfile {
  const sorted = [...series].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const last = latest(sorted);
  const lastRent = latest(rent);
  const cutoff = last ? monthKey(last.periodEnd) - 60 : 0;
  return {
    type,
    median: last,
    change12: changeOver(sorted, 12),
    growth: [1, 3, 5, 10].map((y) => annualised(sorted, y)).filter((g): g is NonNullable<typeof g> => g != null).map((g) => ({ years: g.years, perYear: g.perYear, from: g.from, to: g.to, fromCount: g.fromCount, toCount: g.toCount })),
    trend: sorted.filter((p) => monthKey(p.periodEnd) >= cutoff),
    rent: lastRent,
    yield: grossYield(lastRent?.medianWeekly, last?.median),
    bedrooms: [...bedrooms].sort((a, b) => a.bedrooms - b.bedrooms),
  };
}

const TYPE_WORD: Record<DwellingType, string> = { house: "houses", unit: "units" };

/** The market summary paragraph, written only from the figures (brief: never invented). */
export function marketSummary(suburb: string, profiles: TypeProfile[]): string {
  const parts: string[] = [];
  const priced = profiles.filter((p) => p.median?.median != null);
  if (priced.length) {
    parts.push(
      `Over the past 12 months, median sale prices in ${suburb} were ${priced
        .map((p) => `${formatAud(p.median!.median!)} for ${TYPE_WORD[p.type]} (${p.median!.count} sale${p.median!.count === 1 ? "" : "s"})`)
        .join(" and ")}.`,
    );
  } else {
    parts.push(`There were no recorded sales in ${suburb} in the past 12 months.`);
  }
  for (const p of profiles) {
    if (p.change12) {
      const dir = p.change12.change >= 0 ? "up" : "down";
      parts.push(
        `The ${TYPE_WORD[p.type]} median is ${dir} ${formatRatio(Math.abs(p.change12.change))} on the previous 12 months (${p.change12.toCount} sales this year, ${p.change12.fromCount} the year before).`,
      );
    }
  }
  const rented = profiles.filter((p) => p.rent?.medianWeekly != null);
  if (rented.length) {
    parts.push(
      `Median rents are ${rented
        .map((p) => `${formatAud(p.rent!.medianWeekly!)} a week for ${TYPE_WORD[p.type]}${p.yield != null ? ` (gross yield ${formatRatio(p.yield)})` : ""}`)
        .join(" and ")}.`,
    );
  }
  parts.push("Past growth doesn't predict future growth.");
  return parts.join(" ");
}

/** What Compare needs about a property's suburb (one dwelling type), with its evidence. */
export type SuburbSnapshot = {
  suburb: string;
  state: string;
  postcode: string;
  type: DwellingType;
  median: number | null;
  sales12: number;
  change12: Change | null;
  growth: { years: number; perYear: number; fromCount: number; toCount: number } | null; // longest of 5 / 3 / 1 years
  isDemo: boolean;
};

export function snapshotFrom(p: TypeProfile, where: { suburb: string; state: string; postcode: string }, isDemo: boolean): SuburbSnapshot {
  const growth = [5, 3, 1].map((y) => p.growth.find((g) => g.years === y)).find((g) => g != null) ?? null;
  return {
    ...where,
    type: p.type,
    median: p.median?.median ?? null,
    sales12: p.median?.count ?? 0,
    change12: p.change12,
    growth: growth ? { years: growth.years, perYear: growth.perYear, fromCount: growth.fromCount, toCount: growth.toCount } : null,
    isDemo,
  };
}

/** Plain-language caution when a suburb figure rests on few sales (shown in Compare explanations). */
export function smallSampleWarning(label: string, s: SuburbSnapshot): string | null {
  const counts = [s.sales12, s.change12?.fromCount, s.growth?.fromCount].filter((n): n is number => n != null);
  const fewest = Math.min(...counts);
  if (!counts.length || fewest >= 12) return null;
  return `${label}: the ${s.suburb} ${s.type === "house" ? "house" : "unit"} figures rest on as few as ${fewest} sale${fewest === 1 ? "" : "s"} in a period, so a few unusual sales can swing them. Treat its growth figures with caution.`;
}
