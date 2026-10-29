import { APP_TIME_ZONE } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { evidenceSourceLabel, type KeyValue, type ReportInput, type ReportModel } from "./model";

/** Escape text for HTML element content and attribute values. Every dynamic value goes through this. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const e = escapeHtml;

const STATUS_LABEL: Record<string, string> = {
  verified: "Verified against source",
  unverified: "Unverified",
  disputed: "Disputed",
  superseded: "Superseded",
  unreviewed: "AI flag: unreviewed",
  needs_clarification: "AI flag: needs clarification",
  confirmed: "Confirmed by professional",
  rejected: "Rejected by professional",
};

const sydney = new Intl.DateTimeFormat("en-AU", { dateStyle: "long", timeStyle: "short", timeZone: APP_TIME_ZONE });

function kvTable(rows: KeyValue[], caption: string) {
  return `<table><caption>${e(caption)}</caption><tbody>${rows
    .map((r) => `<tr><th scope="row">${e(r.label)}</th><td>${e(r.value)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function evidenceList(items: ReportInput["evidence"]) {
  if (items.length === 0) return `<p class="empty">None recorded.</p>`;
  return `<ul class="items">${items
    .map((ev) => {
      // Only https URLs can be stored (DB constraint); demo URLs are shown as text, never linked.
      const url = ev.sourceUrl
        ? ev.isDemo || !ev.sourceUrl.startsWith("https://")
          ? `<code>${e(ev.sourceUrl)}</code>`
          : `<a href="${e(ev.sourceUrl)}" rel="noopener noreferrer nofollow">${e(ev.sourceUrl)}</a>`
        : "";
      const verified = ev.status === "verified" && ev.verifiedBy ? ` by ${e(ev.verifiedBy)} on ${e(formatDate(ev.verifiedAt))}` : "";
      return `<li><p class="item-title">${e(ev.title)}${ev.isDemo ? ` <span class="tag demo">Demo · unverified</span>` : ""}</p>
<p class="meta">${e(evidenceSourceLabel(ev.sourceType))} · retrieved ${e(formatDate(ev.fetchedAt))} · <span class="tag">${e(STATUS_LABEL[ev.status] ?? ev.status)}${verified}</span></p>
${url ? `<p class="meta">${url}</p>` : ""}${ev.notes ? `<p>${e(ev.notes)}</p>` : ""}</li>`;
    })
    .join("")}</ul>`;
}

function findingList(items: ReportInput["findings"], empty: string) {
  if (items.length === 0) return `<p class="empty">${e(empty)}</p>`;
  return `<ul class="items">${items
    .map((f) => {
      const review =
        f.reviewer && (f.status === "confirmed" || f.status === "rejected")
          ? `<p class="meta">${e(STATUS_LABEL[f.status]!)}: ${e(f.reviewer)}, ${e(formatDate(f.reviewedAt))}</p>${f.reviewerNote ? `<p>Reviewer note: ${e(f.reviewerNote)}</p>` : ""}`
          : "";
      return `<li><p class="item-title">${e(f.category.replace(/_/g, " "))} <span class="tag">${e(STATUS_LABEL[f.status] ?? f.status)}</span></p>
<p class="meta">${e(f.document)} · page ${e(String(f.page))}${f.confidence !== null ? ` · model confidence ${e(String(Math.round(f.confidence * 100)))}%` : ""}</p>
<blockquote>${e(f.text)}</blockquote>${review}</li>`;
    })
    .join("")}</ul>`;
}

/** Report body (no <html> wrapper), shared by the in-app page and the downloaded file. */
export function renderReportBody(m: ReportModel): string {
  const generated = sydney.format(new Date(m.generatedAt));
  return `<header>
<h1>${e(m.title)}</h1>
<p class="meta">Prepared for ${e(m.organisation)} by ${e(m.generatedBy)} · ${e(generated)} (Sydney time)</p>
<p class="meta">${m.versions.map((v) => `${e(v.label)}: ${e(v.value)}`).join(" · ")}</p>
${m.isDemo ? `<p class="banner">DEMO DATA. UNVERIFIED. This report is generated from synthetic fixtures and does not describe a real property.</p>` : ""}
</header>

<section aria-labelledby="s1"><h2 id="s1">1. Sourced facts</h2>
<p class="lead">What has been recorded about the property, and from where. Only items checked against their official source are listed as verified.</p>
${kvTable(m.facts.property, "Property as recorded")}
<h3>Verified against source</h3>${evidenceList(m.facts.verified)}
<h3>Recorded but not verified</h3>${evidenceList(m.facts.unverified)}
</section>

<section aria-labelledby="s2"><h2 id="s2">2. Assumptions</h2>
<p class="lead">The investor's own inputs. None of these are facts, valuations or quotes.</p>
${m.assumptions.length === 0 ? `<p class="empty">No scenarios modelled.</p>` : m.assumptions.map((a) => `<h3>${e(a.scenario)}</h3>${kvTable(a.items, `Assumptions: ${a.scenario}`)}`).join("")}
<h3>Calculated results (derived from the assumptions above, pre-tax)</h3>
${m.results.length === 0 ? `<p class="empty">No scenarios modelled.</p>` : m.results
    .map(
      (r) => `<h4>${e(r.scenario)}</h4>${kvTable(r.headline, `Results: ${r.scenario}`)}
${r.warnings.length ? `<ul class="warnings">${r.warnings.map((w) => `<li>Warning: ${e(w)}</li>`).join("")}</ul>` : ""}
<p class="meta">${e(r.sensitivity)}</p>`,
    )
    .join("")}
</section>

<section aria-labelledby="s3"><h2 id="s3">3. AI flags (not reviewed)</h2>
<p class="lead">Issues extracted by software from uploaded documents, with the page they came from. Not legal conclusions and not yet checked by a professional.</p>
${findingList(m.aiFlags, "No unreviewed AI flags.")}
</section>

<section aria-labelledby="s4"><h2 id="s4">4. Reviewer-confirmed conclusions</h2>
<p class="lead">Extracted items a licensed professional has reviewed against the source document.</p>
${findingList(m.reviewed, "No items have been reviewed by a professional yet.")}
</section>

<section aria-labelledby="s5"><h2 id="s5">Limitations</h2>
<ul>${m.limitations.map((l) => `<li>${e(l)}</li>`).join("")}</ul>
</section>`;
}

export const REPORT_CSS = `
.sp-report{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;line-height:1.5;max-width:860px;margin:0 auto}
.sp-report h1{font-size:1.5rem;margin:0 0 .25rem}
.sp-report h2{font-size:1.15rem;margin:2rem 0 .25rem;padding-top:1rem;border-top:1px solid #e2e8f0}
.sp-report h3{font-size:1rem;margin:1.25rem 0 .5rem}
.sp-report h4{font-size:.95rem;margin:1rem 0 .5rem}
.sp-report .meta{color:#475569;font-size:.85rem;margin:.15rem 0}
.sp-report .lead{color:#334155;font-size:.9rem;margin:.25rem 0 .75rem}
.sp-report .empty{color:#64748b;font-style:italic;font-size:.9rem}
.sp-report .banner{background:#fffbeb;border:1px solid #fcd34d;color:#78350f;padding:.6rem .8rem;border-radius:.5rem;font-weight:600;font-size:.9rem}
.sp-report table{border-collapse:collapse;width:100%;font-size:.9rem;margin:.25rem 0}
.sp-report caption{text-align:left;font-size:.8rem;color:#64748b;padding-bottom:.25rem}
.sp-report th,.sp-report td{border-bottom:1px solid #e2e8f0;padding:.35rem .5rem;vertical-align:top}
.sp-report th{text-align:left;font-weight:400;color:#334155;width:55%}
.sp-report td{text-align:right;font-variant-numeric:tabular-nums}
.sp-report ul.items{list-style:none;padding:0;margin:0}
.sp-report ul.items>li{border:1px solid #e2e8f0;border-radius:.5rem;padding:.6rem .8rem;margin:.5rem 0;break-inside:avoid}
.sp-report .item-title{font-weight:600;margin:0}
.sp-report .tag{display:inline-block;font-size:.75rem;font-weight:500;border:1px solid #cbd5e1;border-radius:999px;padding:0 .45rem;color:#334155}
.sp-report .tag.demo{border-color:#fcd34d;background:#fffbeb;color:#78350f}
.sp-report blockquote{margin:.4rem 0;padding-left:.75rem;border-left:3px solid #cbd5e1;color:#1e293b}
.sp-report code{font-size:.8rem;word-break:break-all;color:#475569}
.sp-report a{color:#1b46a8;word-break:break-all}
.sp-report ul.warnings{color:#991b1b;font-size:.9rem}
.sp-report ul:not(.items){list-style:disc;padding-left:1.25rem;margin:.5rem 0}
.sp-report ul:not(.items)>li{margin:.2rem 0}
@media print{.sp-report h2{break-after:avoid}.no-print{display:none!important}body{background:#fff}}
`;

/** Standalone, script-free HTML document for download. */
export function renderReportDocument(m: ReportModel): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${e(m.title)}</title>
<style>body{margin:0;padding:2rem 1rem;background:#fff}${REPORT_CSS}</style>
</head>
<body><article class="sp-report">
${renderReportBody(m)}
</article></body>
</html>
`;
}
