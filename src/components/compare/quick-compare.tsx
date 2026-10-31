"use client";

import { AlertTriangle, ArrowRight, Award, ImageOff } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { DemoTag, NotForSaleTag } from "@/components/discovery/listing-card";
import { PropertyIllustration } from "@/components/discovery/property-illustration";
import type { CompareAssumptions } from "@/lib/compare/assumptions";
import type { PropertyResult } from "@/lib/compare/engine";
import type { CompareProperty } from "@/lib/compare/facts";
import { confidenceLevel, pricePerSqm, sourceStatus, STATUS_LABEL } from "@/lib/compare/provenance";
import { PRIORITIES, PRIORITY_IDS, quickMatch, type Priority } from "@/lib/compare/quick";
import type { ScoreResult } from "@/lib/compare/score";
import { formatAud, formatRatio } from "@/lib/format";
import { NumberField } from "./controls";
import { SuburbLine } from "./suburb-line";

type Item = { p: CompareProperty; r: PropertyResult; score: ScoreResult };

const TONE = { good: "bg-leaf-50 text-leaf-800", fair: "bg-amber-50 text-amber-900", poor: "bg-red-50 text-red-800" } as const;

function StatusChip({ status, note }: { status: keyof typeof STATUS_LABEL; note: string }) {
  return (
    <span className="inline-flex rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700" title={note}>
      {STATUS_LABEL[status]}
      <span className="sr-only">: {note}</span>
    </span>
  );
}

function Line({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-slate-600">{label}</dt>
        <dd className="text-right tabular-nums">{children}</dd>
      </div>
      {sub ? <p className="text-right text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

/**
 * Quick Compare: the everyday view. Photos (illustrations until licensed listing photos exist),
 * price, repayments, rental potential, and a plain-English best match for the user's priorities.
 */
export function QuickCompare({
  items,
  assumptions: a,
  onAssumption,
  priorities,
  onPriorities,
  onAdvanced,
}: {
  items: Item[];
  assumptions: CompareAssumptions;
  onAssumption: <K extends keyof CompareAssumptions>(k: K, v: CompareAssumptions[K]) => void;
  priorities: Priority[];
  onPriorities: (p: Priority[]) => void;
  onAdvanced: () => void;
}) {
  const match = useMemo(
    () =>
      quickMatch(
        items.map(({ p, r }) => ({ id: p.listing.id, label: p.listing.headline, result: r, bedrooms: p.listing.property_type === "land" ? null : p.listing.bedrooms, landAreaSqm: p.listing.land_area_sqm, completeness: p.facts.completeness })),
        priorities,
      ),
    [items, priorities],
  );
  const rank = new Map(match.ranking.map((x, i) => [x.id, i]));
  const ordered = [...items].sort((x, y) => rank.get(x.p.listing.id)! - rank.get(y.p.listing.id)!);
  const toggle = (id: Priority) => onPriorities(priorities.includes(id) ? priorities.filter((x) => x !== id) : [...priorities, id]);

  return (
    <div className="space-y-5">
      <section aria-labelledby="priorities-heading" className="space-y-3 rounded-2xl border border-sand-200 bg-white p-4">
        <h2 id="priorities-heading" className="font-display text-lg font-bold">
          What matters most to you?
        </h2>
        <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Your priorities">
          {PRIORITY_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={priorities.includes(id)}
              onClick={() => toggle(id)}
              className="min-h-11 rounded-full border border-sand-300 bg-white px-4 text-sm font-semibold aria-pressed:border-brand-600 aria-pressed:bg-brand-600 aria-pressed:text-white"
            >
              {PRIORITIES[id].label}
            </button>
          ))}
        </div>
        <div className="rounded-2xl bg-brand-50 p-4" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold">
            {match.insufficient ? <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-700" /> : <Award aria-hidden="true" className="h-5 w-5 text-brand-700" />}
            {match.best ? `Best match: ${match.best.label}` : match.tie ? "It's a close call" : match.insufficient ? "No clear leader yet" : "Choose your priorities"}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {match.explanation.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          Ranked only on the priorities you pick, from reported and estimated figures (none independently verified yet). Repayments assume a {a.depositPct}% deposit at{" "}
          {a.interestRatePct}% over {a.loanTermYears} years. Not financial advice.
        </p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Properties">
        {ordered.map(({ p, r, score }) => {
          const l = p.listing;
          const isBest = match.best?.id === l.id;
          const rent = r.annualRent.known ? r.annualRent.value / 52 : null;
          const ppsm = pricePerSqm(r.price.known ? r.price.value : null, l.land_area_sqm, l.property_type);
          const conf = confidenceLevel(p.facts.completeness);
          const priceStatus = sourceStatus(r.priceSource, l.is_demo);
          const rentStatus = sourceStatus(p.facts.rentSource === "listing" ? "listing" : p.facts.rentSource === "estimate" ? "estimate" : null, l.is_demo);
          const wins = match.ranking.find((x) => x.id === l.id)?.wins ?? [];
          return (
            <li key={l.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isBest ? "border-brand-500 ring-2 ring-brand-500" : "border-sand-200"}`}>
              <div className="relative">
                <PropertyIllustration type={l.property_type} kind={l.kind} seed={l.illustration_seed} className="aspect-[16/10] w-full" />
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs text-slate-700">
                  <ImageOff aria-hidden="true" className="h-3 w-3" /> Illustration: no photo yet
                </span>
                {isBest ? (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">
                    <Award aria-hidden="true" className="h-3.5 w-3.5" /> Best match
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <div className="flex flex-wrap gap-1">
                    {l.is_demo ? <DemoTag /> : null}
                    {l.market === "off_market" ? <NotForSaleTag /> : null}
                  </div>
                  <Link href={`/listings/${l.id}`} className="mt-1 block font-semibold text-slate-900 hover:underline">
                    {l.headline}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {l.suburb} {l.state}
                    {l.property_type === "land" ? " · Vacant land" : ` · ${l.bedrooms ?? "?"} bed · ${l.bathrooms ?? "?"} bath · ${l.car_spaces ?? "?"} car`}
                  </p>
                </div>
                <dl className="space-y-2 text-sm">
                  <Line
                    label={r.priceSource === "estimate" ? "Estimated value" : r.priceSource === "user" ? "Your price" : "Asking price"}
                    sub={
                      r.priceSource === "estimate" && p.estimate
                        ? `Range ${formatAud(p.estimate.value_low)}–${formatAud(p.estimate.value_high)}${p.estimate.is_demo ? " (DEMO)" : ""}. Not a price.`
                        : null
                    }
                  >
                    <span className="font-display text-lg font-extrabold">{r.price.known ? formatAud(r.price.value) : "Unknown"}</span>
                  </Line>
                  <Line label="Price per m² of land">
                    {ppsm != null ? formatAud(ppsm) : <span className="text-slate-500">{l.property_type === "apartment" ? "n/a (apartment)" : "Unknown"}</span>}
                  </Line>
                  <Line label="Land · building area">
                    {l.land_area_sqm ? `${l.land_area_sqm.toLocaleString("en-AU")} m²` : <span className="text-slate-500">Unknown</span>}
                    {" · "}
                    <span className="text-slate-500">Unknown</span>
                  </Line>
                  <Line label="Estimated repayments">{r.annualRepayments.known ? `${formatAud(r.annualRepayments.value / 12)}/month` : <span className="text-slate-500">Unknown</span>}</Line>
                  <Line
                    label="Rental potential"
                    sub={rent != null ? `${r.grossYield.known ? `${formatRatio(r.grossYield.value)} gross yield · ` : ""}${rentStatus?.note ?? ""}` : null}
                  >
                    {rent != null ? `${formatAud(rent)}/week` : <span className="text-slate-500">Unknown</span>}
                  </Line>
                  <Line label="Investment Match Score" sub={score.score == null ? `${Math.round(score.coverage * 100)}% of the weighting has evidence` : `${Math.round(score.coverage * 100)}% of the weighting scored`}>
                    {score.score != null ? <strong>{score.score}/100</strong> : <span className="text-slate-500">Not enough evidence</span>}
                  </Line>
                </dl>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[conf.tone]}`}>
                    {conf.label} confidence · {Math.round(p.facts.completeness * 100)}% of key data
                  </span>
                  {priceStatus ? <StatusChip status={priceStatus.status} note={`Price: ${priceStatus.note}`} /> : null}
                  {rentStatus ? <StatusChip status={rentStatus.status} note={`Rent: ${rentStatus.note}`} /> : null}
                </div>

                {wins.length ? (
                  <p className="flex flex-wrap gap-1">
                    {wins.map((w) => (
                      <span key={w} className="rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf-800">
                        {PRIORITIES[w].label}
                      </span>
                    ))}
                  </p>
                ) : null}

                <details className="rounded-xl bg-sand-50 px-3 py-2 text-sm">
                  <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-700">Why, risks and development</summary>
                  <div className="space-y-3 pb-2 pt-1">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your priorities</p>
                      <ul className="mt-1 space-y-0.5">
                        {priorities.map((pid) => {
                          const v = PRIORITIES[pid].value({ id: l.id, label: l.headline, result: r, bedrooms: l.property_type === "land" ? null : l.bedrooms, landAreaSqm: l.land_area_sqm, completeness: p.facts.completeness });
                          return (
                            <li key={pid} className="flex justify-between gap-2">
                              <span>{PRIORITIES[pid].label}</span>
                              <span className={v == null ? "text-slate-500" : "tabular-nums"}>{v == null ? "Unknown" : PRIORITIES[pid].show(v)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Major risks</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {l.risk_flags.map((f) => (
                          <li key={f}>Open check: {f}</li>
                        ))}
                        <li className="text-slate-600">Flood, bushfire and other hazards: Unknown (no official hazard data connected yet)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Development potential</p>
                      <p className="mt-1">
                        {p.development?.roi != null
                          ? `Scored from your workspace scenario: ${formatRatio(p.development.roi)} return on cost (verified planning record on file).`
                          : p.development
                            ? `Workspace linked, not scored yet: ${p.development.missing.join("; ")}.`
                            : l.development_idea
                              ? `Idea only: ${l.development_idea}. Needs zoning confirmation and professional advice.`
                              : "Not assessed."}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Suburb market and growth</p>
                      <p className="mt-1">
                        <SuburbLine s={p.suburb} />
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Population, employment and supply indicators: not connected yet.</p>
                    </div>
                  </div>
                </details>
              </div>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="quick-assumptions" className="flex flex-wrap items-end gap-3 rounded-2xl border border-sand-200 bg-white p-4 print:hidden">
        <h2 id="quick-assumptions" className="sr-only">
          Loan assumptions
        </h2>
        <div className="w-32">
          <NumberField label="Deposit" suffix="%" min={0} max={100} step={0.5} value={a.depositPct} onChange={(v) => v != null && onAssumption("depositPct", v)} />
        </div>
        <div className="w-32">
          <NumberField label="Interest rate" suffix="%" min={0} max={30} step={0.05} value={a.interestRatePct} onChange={(v) => v != null && onAssumption("interestRatePct", v)} />
        </div>
        <button type="button" onClick={onAdvanced} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
          See the full analysis <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
}
