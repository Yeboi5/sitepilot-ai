import { assumptionsSchema, type Assumptions, type Strategy } from "./assumptions";

/** Units drive input formatting and how values are displayed back. */
export type Unit = "aud" | "aud_month" | "aud_year" | "pct" | "months";

export type FieldDef = { path: string; label: string; unit: Unit; hint?: string };
export type SectionDef = { id: string; title: string; description?: string; strategies?: Strategy[]; fields: FieldDef[] };

/** Single source of truth for the scenario editor and its parser. */
export const SECTIONS: SectionDef[] = [
  {
    id: "land",
    title: "Land",
    fields: [{ path: "land.amount", label: "Purchase price or current value", unit: "aud", hint: "If you already own it, use its current value as the opportunity cost." }],
  },
  {
    id: "acquisition",
    title: "Acquisition costs",
    fields: [
      { path: "acquisition.stampDuty", label: "Stamp duty (your estimate)", unit: "aud", hint: "Assumption. SitePilot does not calculate duty; confirm the amount with your state revenue office or your conveyancer." },
      { path: "acquisition.legalAndOther", label: "Legal, searches and other acquisition costs", unit: "aud" },
    ],
  },
  {
    id: "soft",
    title: "Design and approvals",
    fields: [{ path: "soft.designAndApprovals", label: "Design, consultants and approval fees", unit: "aud" }],
  },
  {
    id: "hard",
    title: "Construction",
    fields: [
      { path: "hard.demolition", label: "Demolition", unit: "aud" },
      { path: "hard.siteWorks", label: "Site works", unit: "aud" },
      { path: "hard.construction", label: "Build cost", unit: "aud" },
      { path: "hard.infrastructure", label: "Infrastructure contributions and services", unit: "aud" },
      { path: "contingencyPct", label: "Contingency", unit: "pct", hint: "Applied to design, approval and construction costs." },
    ],
  },
  {
    id: "timeline",
    title: "Timeline",
    fields: [
      { path: "timeline.projectMonths", label: "Project duration", unit: "months", hint: "From settlement to sale or completion." },
      { path: "timeline.constructionStartMonth", label: "Construction starts in month", unit: "months", hint: "0 is the first month." },
      { path: "timeline.constructionMonths", label: "Construction duration", unit: "months" },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    description: "Debt is drawn for land at the start and for construction as it is spent; interest is capitalised monthly.",
    fields: [
      { path: "finance.interestRatePct", label: "Interest rate (per year)", unit: "pct" },
      { path: "finance.landDebtPct", label: "Share of land funded by debt", unit: "pct" },
      { path: "finance.constructionDebtPct", label: "Share of construction funded by debt", unit: "pct" },
      { path: "finance.financeFees", label: "Loan establishment and other fees", unit: "aud" },
    ],
  },
  {
    id: "holding",
    title: "Holding costs",
    fields: [{ path: "holding.monthlyHoldingCosts", label: "Holding costs per month", unit: "aud_month", hint: "Council rates, water, insurance and your land tax estimate." }],
  },
  {
    id: "sale",
    title: "Sale",
    strategies: ["develop_and_sell"],
    fields: [
      { path: "sale.grossRealisation", label: "Assumed sale value on completion", unit: "aud", hint: "Your assumption, not a valuation." },
      { path: "sale.sellingCostsPct", label: "Selling costs (agent and marketing)", unit: "pct" },
    ],
  },
  {
    id: "rent",
    title: "Rent and value",
    strategies: ["retain_and_rent"],
    fields: [
      { path: "rent.endValue", label: "Assumed value on completion", unit: "aud", hint: "Your assumption, not a valuation." },
      { path: "rent.currentGrossRentAnnual", label: "Current gross rent", unit: "aud_year", hint: "0 if vacant or owner-occupied." },
      { path: "rent.projectedGrossRentAnnual", label: "Projected gross rent after the works", unit: "aud_year" },
      { path: "rent.incrementalOperatingCostsAnnual", label: "Additional operating costs", unit: "aud_year", hint: "Extra rates, insurance, management and maintenance." },
    ],
  },
];

export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

export function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function setAt(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) {
    cur[k] = (cur[k] as Record<string, unknown> | undefined) ?? {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]!] = value;
}

/** Accepts "1,200,000", "$1200000", "6.5%" and blank (= 0). */
export function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (raw === null || typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[\s,$%]/g, "");
  if (cleaned === "") return 0;
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

export type ParsedAssumptions = { ok: true; data: Assumptions } | { ok: false; fieldErrors: Record<string, string[]> };

export function parseAssumptionsForm(formData: FormData): ParsedAssumptions {
  const fieldErrors: Record<string, string[]> = {};
  const draft: Record<string, unknown> = {
    strategy: formData.get("strategy"),
    land: { basis: formData.get("land.basis") },
  };
  for (const f of ALL_FIELDS) {
    const n = parseNumber(formData.get(f.path));
    if (n === null) fieldErrors[f.path] = ["Enter a number"];
    else setAt(draft, f.path, n);
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const parsed = assumptionsSchema.safeParse(draft);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, fieldErrors };
  }
  return { ok: true, data: parsed.data };
}
