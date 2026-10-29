import type { Assumptions } from "@/lib/finance/assumptions";
import { STRATEGY_LABELS } from "@/lib/finance/assumptions";
import { FORMULA_VERSION, type FeasibilityResult } from "@/lib/finance/feasibility";
import { SECTIONS, getAt, type Unit } from "@/lib/finance/form";
import { sensitivity } from "@/lib/finance/sensitivity";
import { sydneyDate } from "@/lib/dates";
import { formatAud, formatRatio } from "@/lib/format";
import { EVIDENCE_SOURCE_LABELS } from "@/lib/validation";
import type { Enums } from "@/lib/supabase/database.types";

export const REPORT_VERSION = "report-1.0.0";

export type ReportInput = {
  generatedAt: Date;
  generatedBy: string;
  organisation: string;
  property: { address: string; suburb: string | null; postcode: string | null; jurisdiction: string; lotDp: string | null; isDemo: boolean };
  evidence: {
    title: string;
    sourceType: Enums<"evidence_source_type">;
    sourceUrl: string | null;
    fetchedAt: string;
    status: Enums<"evidence_status">;
    verifiedBy: string | null;
    verifiedAt: string | null;
    notes: string | null;
    isDemo: boolean;
  }[];
  scenarios: { name: string; assumptions: Assumptions; result: FeasibilityResult }[];
  findings: {
    document: string;
    category: string;
    text: string;
    page: number;
    confidence: number | null;
    status: Enums<"finding_status">;
    reviewer: string | null;
    reviewedAt: string | null;
    reviewerNote: string | null;
  }[];
};

export type KeyValue = { label: string; value: string };

export type ReportModel = {
  title: string;
  generatedAt: string;
  generatedBy: string;
  organisation: string;
  versions: KeyValue[];
  isDemo: boolean;
  /** 1. Facts recorded from sources (with verification status). */
  facts: {
    property: KeyValue[];
    verified: ReportInput["evidence"];
    unverified: ReportInput["evidence"];
  };
  /** 2. The investor's assumptions, per scenario. */
  assumptions: { scenario: string; strategy: string; items: KeyValue[] }[];
  /** Calculated outputs (derived from 2; never facts). */
  results: { scenario: string; headline: KeyValue[]; warnings: string[]; sensitivity: string }[];
  /** 3. Machine-extracted flags not yet confirmed by a professional. */
  aiFlags: ReportInput["findings"];
  /** 4. Items a professional has reviewed (confirmed or rejected). */
  reviewed: ReportInput["findings"];
  limitations: string[];
};

const UNIT_FORMAT: Record<Unit, (v: number) => string> = {
  aud: (v) => formatAud(v),
  aud_month: (v) => `${formatAud(v)} per month`,
  aud_year: (v) => `${formatAud(v)} per year`,
  pct: (v) => `${v}%`,
  months: (v) => `${v} month${v === 1 ? "" : "s"}`,
};

function assumptionItems(a: Assumptions): KeyValue[] {
  const items: KeyValue[] = [
    { label: "Strategy", value: STRATEGY_LABELS[a.strategy] },
    { label: "Land basis", value: a.land.basis === "purchase_price" ? "Purchase price" : "Current value (opportunity cost)" },
  ];
  for (const section of SECTIONS) {
    if (section.strategies && !section.strategies.includes(a.strategy)) continue;
    for (const f of section.fields) {
      items.push({ label: f.label, value: UNIT_FORMAT[f.unit](getAt(a, f.path) as number) });
    }
  }
  return items;
}

function headlineItems(r: FeasibilityResult): KeyValue[] {
  const common = [
    { label: "Total development cost", value: formatAud(r.totalDevelopmentCost) },
    { label: "Interest (capitalised)", value: formatAud(r.costs.interest) },
    { label: "Equity required", value: formatAud(r.finance.equityRequired) },
    { label: "Peak debt", value: formatAud(r.finance.peakDebt) },
  ];
  if (r.sale) {
    return [
      { label: "Assumed sale value", value: formatAud(r.sale.realisation) },
      { label: "Margin", value: formatAud(r.sale.margin) },
      { label: "Return on cost (ROI)", value: formatRatio(r.sale.roi) },
      ...common,
    ];
  }
  const rent = r.rent!;
  return [
    { label: "Incremental project cost", value: formatAud(rent.incrementalCost) },
    { label: "Yield on incremental cost", value: formatRatio(rent.yieldOnIncrementalCost) },
    { label: "Cash flow after interest", value: `${formatAud(rent.cashFlowAfterInterestAnnual)} per year` },
    { label: "Valuation uplift minus costs", value: formatAud(rent.upliftMinusCosts) },
    ...common,
  ];
}

export function buildReport(input: ReportInput): ReportModel {
  const p = input.property;
  return {
    title: `Feasibility and due-diligence report: ${p.address}${p.suburb ? `, ${p.suburb}` : ""}`,
    generatedAt: input.generatedAt.toISOString(),
    generatedBy: input.generatedBy,
    organisation: input.organisation,
    versions: [
      { label: "Report format", value: REPORT_VERSION },
      { label: "Feasibility formula", value: FORMULA_VERSION },
    ],
    isDemo: p.isDemo,
    facts: {
      property: [
        { label: "Address", value: p.address },
        { label: "Suburb", value: p.suburb ?? "Not recorded" },
        { label: "Postcode", value: p.postcode ?? "Not recorded" },
        { label: "Jurisdiction", value: p.jurisdiction },
        { label: "Lot / DP", value: p.lotDp ?? "Not recorded" },
      ],
      verified: input.evidence.filter((e) => e.status === "verified"),
      unverified: input.evidence.filter((e) => e.status !== "verified"),
    },
    assumptions: input.scenarios.map((s) => ({
      scenario: s.name,
      strategy: STRATEGY_LABELS[s.assumptions.strategy],
      items: assumptionItems(s.assumptions),
    })),
    results: input.scenarios.map((s) => {
      const sens = sensitivity(s.assumptions);
      return {
        scenario: s.name,
        headline: headlineItems(s.result),
        warnings: s.result.warnings.map((w) => w.message),
        sensitivity:
          sens.negativeCases === 0
            ? `No negative outcome across ${sens.totalCases} sensitivity cases (construction ±15%, end value ±15%, interest ±2 pp).`
            : `${sens.negativeCases} of ${sens.totalCases} sensitivity cases are negative (construction ±15%, end value ±15%, interest ±2 pp).`,
      };
    }),
    aiFlags: input.findings.filter((f) => f.status === "unreviewed" || f.status === "needs_clarification"),
    reviewed: input.findings.filter((f) => f.status === "confirmed" || f.status === "rejected"),
    limitations: [
      "This report is not legal, planning, financial, valuation or tax advice.",
      "Feasibility figures are calculated from the assumptions listed in section 2, which are the investor's own and have not been verified.",
      "Results are pre-tax. GST, capital gains tax and income tax are not modelled.",
      "Section 1 lists only what has been recorded in SitePilot. Items marked unverified have not been checked against their source.",
      "AI flags in section 3 are machine-extracted and may be wrong or incomplete. They are not legal conclusions.",
      "Items in section 4 record a professional's review of a specific extracted item only; they are not a full review of the property or contract.",
      ...(p.isDemo ? ["This property is synthetic demo data. Nothing in this report relates to a real property."] : []),
    ],
  };
}

export function evidenceSourceLabel(t: Enums<"evidence_source_type">) {
  return EVIDENCE_SOURCE_LABELS[t];
}

export function reportFileName(address: string, at: Date = new Date()) {
  const slug = address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "property";
  return `sitepilot-report-${slug}-${sydneyDate(at)}.html`;
}
