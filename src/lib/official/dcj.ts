/**
 * Parser for the NSW Rent and Sales Report tables (Department of Communities and Justice).
 * Licence: CC BY 4.0, © State of New South Wales (Department of Communities and Justice).
 *
 * Pure: takes the cell rows of a "Postcode" sheet and returns normalised records. It keeps DCJ's own
 * categories and suppression: "-" = 10 or fewer (nothing published), "s" = 30 or fewer (median
 * published, count withheld). Sales prices are published in $'000 and converted to dollars.
 */
export const DCJ_LICENCE = "CC BY 4.0 · © State of New South Wales (Department of Communities and Justice)";
export const DCJ_SOURCE_PAGE = "https://dcj.nsw.gov.au/about-us/families-and-communities-statistics/housing-rent-and-sales/rent-and-sales-report.html";

export type Dataset = "nsw_dcj_sales" | "nsw_dcj_rent";
export type CountNote = "exact" | "30_or_fewer" | "10_or_fewer";
export type DcjRecord = {
  dataset: Dataset;
  areaCode: string;
  category: string;
  dwellingType: "all" | "house" | "unit" | "townhouse" | "other";
  bedrooms: string;
  periodStart: string;
  periodEnd: string;
  q1: number | null;
  median: number | null;
  q3: number | null;
  mean: number | null;
  count: number | null;
  countNote: CountNote;
  changeQuarterly: number | null;
  changeAnnual: number | null;
  bondsHeld: number | null;
};

type Cell = string | number | null | undefined;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** "Reporting period: January - March 2026" / "April to June 2026" → first and last day. */
export function parsePeriod(text: string): { start: string; end: string } | null {
  const m = /(january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:-|–|to)\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i.exec(text);
  if (!m) return null;
  const a = MONTHS.indexOf(m[1]!.toLowerCase()) + 1;
  const b = MONTHS.indexOf(m[2]!.toLowerCase()) + 1;
  const y = Number(m[3]);
  const sy = a > b ? y - 1 : y; // e.g. "November - January 2026"
  return { start: iso(sy, a, 1), end: iso(y, b, lastDay(y, b)) };
}

const text = (c: Cell) => (c == null ? "" : String(c).trim());

/** A published number, or null for "-", "s", blanks and anything unparseable. */
export function num(c: Cell, scale = 1): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? Math.round(c * scale) : null;
  const t = text(c).replace(/[$,\s]/g, "");
  if (!t || t === "-" || t.toLowerCase() === "s" || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Math.round(Number(t) * scale);
}

/** "3.99%" or 0.0399 → 0.0399; "-", "s" → null. */
export function pct(c: Cell): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? Math.round(c * 10000) / 10000 : null;
  const t = text(c).replace(/[,\s]/g, "");
  const m = /^(-?\d*\.?\d+)%$/.exec(t);
  return m ? Math.round((Number(m[1]) / 100) * 10000) / 10000 : null;
}

function countOf(c: Cell): { count: number | null; note: CountNote } {
  const t = text(c).toLowerCase();
  if (t === "-") return { count: null, note: "10_or_fewer" };
  if (t === "s") return { count: null, note: "30_or_fewer" };
  return { count: num(c), note: "exact" };
}

function dwelling(category: string): DcjRecord["dwellingType"] {
  const c = category.toLowerCase();
  if (c === "total") return "all";
  if (c.startsWith("non strata") || c === "house" || c === "houses") return "house";
  if (c.startsWith("strata") || c.includes("flat") || c.includes("unit")) return "unit";
  if (c.includes("townhouse")) return "townhouse";
  return "other";
}

/** Find the header row (it has a "Postcode" column) and map columns by their header text. */
function headerIndex(rows: Cell[][]) {
  const i = rows.findIndex((r) => r.some((c) => /^postcode$/i.test(text(c))));
  if (i < 0) return null;
  const h = rows[i]!.map((c) => text(c).toLowerCase().replace(/\s+/g, " "));
  const col = (re: RegExp) => h.findIndex((x) => re.test(x));
  return {
    row: i,
    postcode: col(/^postcode$/),
    category: col(/^dwelling ?types?$/),
    bedrooms: col(/bedroom/),
    q1: col(/first quartile/),
    median: col(/^median/),
    q3: col(/third quartile/),
    mean: col(/^mean/),
    count: col(/^(sales no|new bonds lodged no)/),
    bondsHeld: col(/total bonds held/),
    changeQ: col(/^(qtly|quarterly) change in median/),
    changeA: col(/^annual change in median/),
  };
}

export function parsePostcodeSheet(rows: Cell[][], dataset: Dataset): { records: DcjRecord[]; period: { start: string; end: string } } {
  const period = rows.slice(0, 10).map((r) => parsePeriod(r.map(text).join(" "))).find((p) => p != null);
  if (!period) throw new Error("No reporting period found in the sheet");
  const h = headerIndex(rows);
  if (!h || h.median < 0 || h.count < 0 || h.category < 0) throw new Error("Unrecognised DCJ table layout");
  const scale = dataset === "nsw_dcj_sales" ? 1000 : 1; // sales prices are in $'000
  const records: DcjRecord[] = [];
  for (const r of rows.slice(h.row + 1)) {
    const pc = text(r[h.postcode]).replace(/\.0$/, "");
    if (!/^\d{4}$/.test(pc)) continue;
    const category = text(r[h.category]);
    if (!category) continue;
    const { count, note } = countOf(r[h.count]);
    const median = note === "10_or_fewer" ? null : num(r[h.median], scale);
    records.push({
      dataset,
      areaCode: pc,
      category,
      dwellingType: dwelling(category),
      bedrooms: h.bedrooms >= 0 ? text(r[h.bedrooms]) || "Total" : "Total",
      periodStart: period.start,
      periodEnd: period.end,
      q1: note === "10_or_fewer" ? null : num(r[h.q1], scale),
      median,
      q3: note === "10_or_fewer" ? null : num(r[h.q3], scale),
      mean: h.mean >= 0 && note !== "10_or_fewer" ? num(r[h.mean], scale) : null,
      count,
      countNote: note,
      changeQuarterly: h.changeQ >= 0 ? pct(r[h.changeQ]) : null,
      changeAnnual: h.changeA >= 0 ? pct(r[h.changeA]) : null,
      bondsHeld: h.bondsHeld >= 0 ? num(r[h.bondsHeld]) : null,
    });
  }
  return { records, period };
}
