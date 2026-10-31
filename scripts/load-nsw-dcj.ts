/**
 * Loads the NSW Rent and Sales Report (DCJ) postcode tables into official_area_stats.
 *
 *   DATABASE_URL=postgresql://… npx tsx scripts/load-nsw-dcj.ts [--latest-only] [--dry-run]
 *
 * Source: https://dcj.nsw.gov.au/…/rent-and-sales-report.html and previous reports, CC BY 4.0,
 * © State of New South Wales (Department of Communities and Justice). Files are cached in
 * .cache/dcj. Sales: every quarter. Rents: all-bedroom figures for every quarter, and the full
 * bedroom breakdown for the latest four quarters (to keep the table lean). Re-running updates rows.
 * Only .xlsx files are read (the two 2017 .xls files use an older format).
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Client } from "pg";
import { DCJ_LICENCE, parsePostcodeSheet, type Dataset, type DcjRecord } from "../src/lib/official/dcj";

const BASE = "https://dcj.nsw.gov.au";
const PAGES = [
  `${BASE}/about-us/families-and-communities-statistics/housing-rent-and-sales/rent-and-sales-report.html`,
  `${BASE}/about-us/families-and-communities-statistics/housing-rent-and-sales/previous-rent-and-sales-reports.html`,
];
const UA = { "User-Agent": "SitePilot data loader (contact: see repository)" };
const args = new Set(process.argv.slice(2));
const cacheDir = path.resolve(__dirname, "../.cache/dcj");

async function fileList(): Promise<{ url: string; dataset: Dataset }[]> {
  const urls = new Set<string>();
  for (const page of PAGES) {
    const html = await (await fetch(page, { headers: UA })).text();
    for (const m of html.matchAll(/href="([^"]+\.xlsx)"/g)) urls.add(new URL(m[1]!, BASE).toString());
  }
  return [...urls]
    .map((url) => {
      const name = url.toLowerCase().split("/").pop()!;
      if (/metro-lgas/.test(name)) return null;
      return { url, dataset: (/sales/.test(name) ? "nsw_dcj_sales" : "nsw_dcj_rent") as Dataset };
    })
    .filter((x): x is { url: string; dataset: Dataset } => x != null);
}

async function download(url: string): Promise<Buffer> {
  mkdirSync(cacheDir, { recursive: true });
  const file = path.join(cacheDir, url.split("/").pop()!);
  if (existsSync(file)) return readFileSync(file);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, buf);
  return buf;
}

type Cell = string | number | null;
function cellValue(v: ExcelJS.CellValue): Cell {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object" && "result" in v) return (v.result as Cell) ?? null;
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text);
  return String(v);
}

async function parse(buf: Buffer, dataset: Dataset) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets.find((w) => /postcode/i.test(w.name)) ?? wb.worksheets.find((w) => /postcode/i.test(String(cellValue(w.getRow(1).getCell(1).value) ?? "")));
  if (!ws) throw new Error("No postcode sheet");
  const rows: Cell[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const r: Cell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => (r[col - 1] = cellValue(cell.value)));
    rows.push(r);
  });
  return parsePostcodeSheet(rows, dataset);
}

async function upsert(db: Client, records: DcjRecord[], sourceUrl: string) {
  const cols = ["dataset", "state", "area_type", "area_code", "category", "dwelling_type", "bedrooms", "period_start", "period_end", "q1", "median", "q3", "mean", "count", "count_note", "change_quarterly", "change_annual", "bonds_held", "source_url", "licence", "status"];
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const values: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      values.push(r.dataset, "NSW", "postcode", r.areaCode, r.category, r.dwellingType, r.bedrooms, r.periodStart, r.periodEnd, r.q1, r.median, r.q3, r.mean, r.count, r.countNote, r.changeQuarterly, r.changeAnnual, r.bondsHeld, sourceUrl, DCJ_LICENCE, "reported");
      return `(${cols.map((_, k) => `$${j * cols.length + k + 1}`).join(", ")})`;
    });
    await db.query(
      `insert into public.official_area_stats (${cols.join(", ")}) values ${tuples.join(", ")}
       on conflict (dataset, area_type, area_code, category, bedrooms, period_end) do update set
         q1 = excluded.q1, median = excluded.median, q3 = excluded.q3, mean = excluded.mean, count = excluded.count,
         count_note = excluded.count_note, change_quarterly = excluded.change_quarterly, change_annual = excluded.change_annual,
         bonds_held = excluded.bonds_held, source_url = excluded.source_url, retrieved_at = now()`,
      values,
    );
  }
}

async function main() {
  const files = await fileList();
  console.log(`found ${files.length} files`);
  const parsed: { url: string; dataset: Dataset; records: DcjRecord[]; end: string }[] = [];
  for (const f of files) {
    try {
      const { records, period } = await parse(await download(f.url), f.dataset);
      parsed.push({ ...f, records, end: period.end });
    } catch (e) {
      console.warn(`skipped ${f.url.split("/").pop()}: ${(e as Error).message}`);
    }
  }
  const latestRentEnds = [...new Set(parsed.filter((p) => p.dataset === "nsw_dcj_rent").map((p) => p.end))].sort().slice(-4);
  const keep = (p: (typeof parsed)[number]) =>
    p.dataset === "nsw_dcj_sales" ? p.records : p.records.filter((r) => r.bedrooms.toLowerCase() === "total" || latestRentEnds.includes(p.end));
  const selected = args.has("--latest-only")
    ? (["nsw_dcj_sales", "nsw_dcj_rent"] as const).map((d) => parsed.filter((p) => p.dataset === d).sort((a, b) => b.end.localeCompare(a.end))[0]).filter((p) => p != null)
    : parsed;
  for (const p of selected) console.log(`${p.dataset} ${p.end}: ${keep(p).length} rows`);
  if (args.has("--dry-run")) return;
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/sitepilot_dev" });
  await db.connect();
  for (const p of selected) await upsert(db, keep(p), p.url);
  const { rows } = await db.query("select dataset, count(*)::int as n, max(period_end) as latest from public.official_area_stats group by 1 order by 1");
  console.log(rows);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
