import { describe, expect, it } from "vitest";
import { EMPTY_ASSUMPTIONS, type Assumptions } from "@/lib/finance/assumptions";
import { calculate } from "@/lib/finance/feasibility";
import { buildReport, type ReportInput } from "./model";
import { escapeHtml, renderReportDocument } from "./render";

const XSS = `<img src=x onerror="alert(1)">`;

function assumptions(f: (a: Assumptions) => void = () => {}): Assumptions {
  const a = structuredClone(EMPTY_ASSUMPTIONS);
  f(a);
  return a;
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  const a = assumptions((x) => ((x.land.amount = 1_000_000), (x.sale.grossRealisation = 900_000)));
  return {
    generatedAt: new Date("2026-10-30T01:00:00Z"),
    generatedBy: "Ivy Investor",
    organisation: "Harbourview",
    property: { address: "76 Sunrise Avenue", suburb: "Halekulani", postcode: "2262", jurisdiction: "NSW", lotDp: null, isDemo: false },
    evidence: [
      { title: "Council certificate", sourceType: "planning_certificate", sourceUrl: "https://example.com/c.pdf", fetchedAt: "2026-10-20", status: "verified", verifiedBy: "Ivy Investor", verifiedAt: "2026-10-21T00:00:00Z", notes: null, isDemo: false },
      { title: "Portal report", sourceType: "planning_portal", sourceUrl: "https://example.com/p", fetchedAt: "2026-10-20", status: "unverified", verifiedBy: null, verifiedAt: null, notes: null, isDemo: false },
    ],
    scenarios: [{ name: "Duplex", assumptions: a, result: calculate(a) }],
    findings: [
      { document: "contract.pdf", category: "settlement_period", text: "42 days", page: 3, confidence: 0.91, status: "unreviewed", reviewer: null, reviewedAt: null, reviewerNote: null },
      { document: "contract.pdf", category: "special_condition", text: "Easement", page: 11, confidence: 0.64, status: "confirmed", reviewer: "Connie Conveyancer", reviewedAt: "2026-10-29T00:00:00Z", reviewerNote: "Checked p11" },
      { document: "contract.pdf", category: "other", text: "Noise", page: 2, confidence: 0.3, status: "rejected", reviewer: "Connie Conveyancer", reviewedAt: "2026-10-29T00:00:00Z", reviewerNote: null },
    ],
    ...over,
  };
}

describe("buildReport", () => {
  const m = buildReport(input());

  it("separates verified from unverified evidence", () => {
    expect(m.facts.verified.map((x) => x.title)).toEqual(["Council certificate"]);
    expect(m.facts.unverified.map((x) => x.title)).toEqual(["Portal report"]);
  });

  it("separates unreviewed AI flags from professionally reviewed items", () => {
    expect(m.aiFlags.map((f) => f.category)).toEqual(["settlement_period"]);
    expect(m.reviewed.map((f) => f.status)).toEqual(["confirmed", "rejected"]);
  });

  it("lists assumptions only for the scenario's strategy", () => {
    const labels = m.assumptions[0]!.items.map((i) => i.label);
    expect(labels).toContain("Assumed sale value on completion");
    expect(labels).not.toContain("Assumed value on completion");
    expect(labels).toContain("Stamp duty (your estimate)");
  });

  it("carries warnings and the sensitivity summary into results", () => {
    expect(m.results[0]!.warnings[0]).toMatch(/negative/);
    expect(m.results[0]!.sensitivity).toMatch(/of 11 sensitivity cases are negative/);
  });

  it("records formula and report versions", () => {
    expect(m.versions.map((v) => v.label)).toEqual(["Report format", "Feasibility formula"]);
  });

  it("adds a demo limitation for demo properties", () => {
    const demo = buildReport(input({ property: { ...input().property, isDemo: true } }));
    expect(demo.limitations.at(-1)).toMatch(/synthetic demo data/);
    expect(m.limitations.some((l) => /demo/.test(l))).toBe(false);
  });
});

describe("renderReportDocument", () => {
  it("escapes every user-supplied value", () => {
    const hostile = input({
      generatedBy: XSS,
      organisation: XSS,
      property: { address: XSS, suburb: XSS, postcode: "2262", jurisdiction: "NSW", lotDp: XSS, isDemo: false },
      evidence: [{ ...input().evidence[0]!, title: XSS, notes: XSS, verifiedBy: XSS }],
      scenarios: [{ ...input().scenarios[0]!, name: XSS }],
      findings: [{ ...input().findings[1]!, document: XSS, text: XSS, reviewer: XSS, reviewerNote: XSS, category: XSS }],
    });
    const html = renderReportDocument(buildReport(hostile));
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/onerror="/);
    expect(html).toContain(escapeHtml(XSS));
  });

  it("never links non-https or demo URLs", () => {
    const html = renderReportDocument(
      buildReport(
        input({
          evidence: [
            { ...input().evidence[0]!, sourceUrl: "javascript:alert(1)" },
            { ...input().evidence[1]!, sourceUrl: "https://demo.sitepilot.invalid/x", isDemo: true },
          ],
        }),
      ),
    );
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="https://demo.sitepilot.invalid');
    expect(html).toContain("<code>javascript:alert(1)</code>");
  });

  it("is a standalone document with no scripts and all four sections in order", () => {
    const html = renderReportDocument(buildReport(input()));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script/i);
    const order = ["1. Sourced facts", "2. Assumptions", "3. AI flags (not reviewed)", "4. Reviewer-confirmed conclusions", "Limitations"].map((h) => html.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the demo banner for demo properties", () => {
    const html = renderReportDocument(buildReport(input({ property: { ...input().property, isDemo: true } })));
    expect(html).toContain("DEMO DATA. UNVERIFIED.");
  });

  it("renders empty sections explicitly", () => {
    const html = renderReportDocument(buildReport(input({ evidence: [], scenarios: [], findings: [] })));
    expect(html).toContain("No scenarios modelled.");
    expect(html).toContain("No unreviewed AI flags.");
    expect(html).toContain("No items have been reviewed by a professional yet.");
  });
});

describe("reportFileName", () => {
  it("slugs the address and dates the file", async () => {
    const { reportFileName } = await import("./model");
    expect(reportFileName("76 Sunrise Avenue", new Date("2026-10-30T01:00:00Z"))).toBe("sitepilot-report-76-sunrise-avenue-2026-10-30.html");
    expect(reportFileName('"; rm -rf / <x>', new Date("2026-10-30T01:00:00Z"))).toBe("sitepilot-report-rm-rf-x-2026-10-30.html");
    expect(reportFileName("!!!", new Date("2026-10-30T01:00:00Z"))).toBe("sitepilot-report-property-2026-10-30.html");
  });
});
