import type { SuburbSnapshot } from "@/lib/suburbs/stats";
import type { CountNote } from "./dcj";

/**
 * Official NSW postcode figures (NSW Rent and Sales Report) shaped for suburb profiles and Compare.
 * Pure. Uses only what DCJ published: suppressed medians stay null, withheld counts keep their note,
 * and a published median of 0 (a source error) is treated as not usable. Multi-year growth is
 * calculated by SitePilot from the published quarterly medians for the same quarter N years apart.
 */
export type OfficialRow = {
  dataset: "nsw_dcj_sales" | "nsw_dcj_rent";
  category: string;
  dwelling_type: string;
  bedrooms: string;
  period_start: string;
  period_end: string;
  median: number | null;
  count: number | null;
  count_note: CountNote;
  change_annual: number | null;
  change_quarterly: number | null;
  source_url: string;
  retrieved_at: string;
};

export type Published = { median: number | null; count: number | null; countNote: CountNote; periodStart: string; periodEnd: string };
export type OfficialType = {
  type: "house" | "unit";
  category: string; // as published, e.g. "Non Strata"
  latest: Published | null;
  changeAnnual: number | null; // as published by DCJ
  changeQuarterly: number | null;
  growth: { years: number; perYear: number; from: Published; to: Published }[];
  trend: Published[];
  rent: (Published & { changeAnnual: number | null }) | null;
  rentByBedrooms: (Published & { bedrooms: string })[];
  yield: number | null;
};
export type OfficialProfile = { postcode: string; house: OfficialType; unit: OfficialType; sourceUrls: string[]; retrievedAt: string | null };

const usable = (m: number | null) => (m != null && m > 0 ? m : null);
const pub = (r: OfficialRow): Published => ({ median: usable(r.median), count: r.count, countNote: r.count_note, periodStart: r.period_start, periodEnd: r.period_end });
const monthsBack = (iso: string, months: number) => {
  const [y, m] = iso.split("-").map(Number);
  const k = y! * 12 + (m! - 1) - months;
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
};

/** "30 or fewer", "10 or fewer" or the exact count, for display. */
export function countText(p: Pick<Published, "count" | "countNote">): string {
  if (p.countNote === "10_or_fewer") return "10 or fewer sales";
  if (p.countNote === "30_or_fewer") return "30 or fewer sales";
  return `${p.count} sale${p.count === 1 ? "" : "s"}`;
}

const SALES_CATEGORY = { house: "Non Strata", unit: "Strata" } as const;
const RENT_TYPE = { house: "house", unit: "unit" } as const;

export function buildOfficialProfile(postcode: string, rows: OfficialRow[]): OfficialProfile | null {
  if (!rows.length) return null;
  const build = (type: "house" | "unit"): OfficialType => {
    const sales = rows
      .filter((r) => r.dataset === "nsw_dcj_sales" && r.category.toLowerCase() === SALES_CATEGORY[type].toLowerCase())
      .sort((a, b) => a.period_end.localeCompare(b.period_end));
    const latestRow = sales.at(-1);
    const latest = latestRow ? pub(latestRow) : null;
    const growth: OfficialType["growth"] = [];
    if (latest?.median != null) {
      for (const years of [3, 5]) {
        const from = sales.find((r) => r.period_end.slice(0, 7) === monthsBack(latest.periodEnd, years * 12));
        if (from && usable(from.median) != null) {
          growth.push({ years, perYear: (latest.median / usable(from.median)!) ** (1 / years) - 1, from: pub(from), to: latest });
        }
      }
    }
    const rents = rows.filter((r) => r.dataset === "nsw_dcj_rent" && r.dwelling_type === RENT_TYPE[type]);
    const lastRentEnd = rents.reduce((a, r) => (r.period_end > a ? r.period_end : a), "");
    const rentTotal = rents.find((r) => r.period_end === lastRentEnd && r.bedrooms.toLowerCase() === "total");
    const rent = rentTotal ? { ...pub(rentTotal), changeAnnual: rentTotal.change_annual } : null;
    return {
      type,
      category: SALES_CATEGORY[type],
      latest,
      changeAnnual: latestRow?.change_annual ?? null,
      changeQuarterly: latestRow?.change_quarterly ?? null,
      growth,
      trend: sales.map(pub),
      rent,
      rentByBedrooms: rents
        .filter((r) => r.period_end === lastRentEnd && !["total", "not specified"].includes(r.bedrooms.toLowerCase()))
        .map((r) => ({ ...pub(r), bedrooms: r.bedrooms })),
      yield: rent?.median != null && latest?.median != null ? (rent.median * 52) / latest.median : null,
    };
  };
  const urls = [...new Set(rows.map((r) => r.source_url))];
  return { postcode, house: build("house"), unit: build("unit"), sourceUrls: urls, retrievedAt: rows.reduce<string | null>((a, r) => (!a || r.retrieved_at > a ? r.retrieved_at : a), null) };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Jan–Mar 2026 quarter". */
export function quarterLabel(p: Pick<Published, "periodStart" | "periodEnd">): string {
  return `${MON[Number(p.periodStart.slice(5, 7)) - 1]}–${MON[Number(p.periodEnd.slice(5, 7)) - 1]} ${p.periodEnd.slice(0, 4)} quarter`;
}

/** Compare's view of a property's area from official postcode figures (null if nothing published). */
export function officialSnapshot(profile: OfficialProfile, type: "house" | "unit", where: { suburb: string; state: string; postcode: string }): SuburbSnapshot | null {
  const t = profile[type];
  if (!t.latest || (t.latest.median == null && !t.growth.length)) return null;
  const g = t.growth.at(-1) ?? null; // longest available (5 or 3 years)
  const prevYear = t.trend.find((p) => p.periodEnd.slice(0, 7) === `${Number(t.latest!.periodEnd.slice(0, 4)) - 1}${t.latest!.periodEnd.slice(4, 7)}`);
  const exact = (p: Published | undefined) => (p && p.countNote === "exact" ? (p.count ?? 0) : 0);
  const smallPeriods = [t.latest, prevYear, g?.from].filter((p): p is Published => !!p && p.countNote !== "exact");
  return {
    ...where,
    type,
    median: t.latest.median,
    sales12: exact(t.latest),
    change12:
      t.changeAnnual != null && t.latest.median != null && prevYear?.median != null
        ? { from: prevYear.median, to: t.latest.median, change: t.changeAnnual, fromCount: exact(prevYear), toCount: exact(t.latest), fromPeriod: prevYear.periodEnd, toPeriod: t.latest.periodEnd }
        : null,
    growth: g ? { years: g.years, perYear: g.perYear, fromCount: exact(g.from), toCount: exact(g.to) } : null,
    isDemo: false,
    official: {
      period: quarterLabel(t.latest),
      category: t.category,
      countText: countText(t.latest),
      small: smallPeriods.length
        ? `postcode ${profile.postcode} ${type === "house" ? "house" : "unit"} figures include a quarter with ${countText(smallPeriods[0]!)}, so a few unusual sales can swing them. Treat its growth figures with caution.`
        : null,
    },
  };
}

/** Plain-English summary written only from the published figures. */
export function officialSummary(profile: OfficialProfile): string {
  const parts: string[] = [];
  const word = { house: "houses (non-strata)", unit: "units and townhouses (strata)" } as const;
  for (const type of ["house", "unit"] as const) {
    const t = profile[type];
    if (!t.latest) continue;
    if (t.latest.median == null) {
      parts.push(`NSW DCJ didn't publish a median for ${word[type]} in the ${quarterLabel(t.latest)} (${countText(t.latest)}).`);
      continue;
    }
    const change = t.changeAnnual != null ? `, ${t.changeAnnual >= 0 ? "up" : "down"} ${(Math.abs(t.changeAnnual) * 100).toFixed(1)}% on a year earlier` : "";
    parts.push(`In the ${quarterLabel(t.latest)}, the median sale price for ${word[type]} in postcode ${profile.postcode} was $${t.latest.median.toLocaleString("en-AU")} (${countText(t.latest)})${change}.`);
    if (t.rent?.median != null) parts.push(`Median weekly rent for new ${type === "house" ? "house" : "unit"} bonds was $${t.rent.median.toLocaleString("en-AU")}.`);
  }
  parts.push("Past growth doesn't predict future growth.");
  return parts.join(" ");
}
