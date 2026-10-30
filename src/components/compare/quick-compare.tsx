"use client";

import { ArrowRight, Award, ImageOff } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { DemoTag, NotForSaleTag } from "@/components/discovery/listing-card";
import { PropertyIllustration } from "@/components/discovery/property-illustration";
import type { CompareAssumptions } from "@/lib/compare/assumptions";
import type { PropertyResult } from "@/lib/compare/engine";
import type { CompareProperty } from "@/lib/compare/facts";
import { PRIORITIES, PRIORITY_IDS, quickMatch, type Priority } from "@/lib/compare/quick";
import { formatAud, formatRatio } from "@/lib/format";
import { NumberField } from "./controls";

type Item = { p: CompareProperty; r: PropertyResult };

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
        items.map(({ p, r }) => ({ id: p.listing.id, label: p.listing.headline, result: r, bedrooms: p.listing.property_type === "land" ? null : p.listing.bedrooms, landAreaSqm: p.listing.land_area_sqm })),
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
        <div className="flex flex-wrap gap-2" role="group" aria-label="Your priorities">
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
            <Award aria-hidden="true" className="h-5 w-5 text-brand-700" />
            {match.best ? `Best match: ${match.best.label}` : match.tie ? "It's a close call" : "Choose your priorities"}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {match.explanation.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          Ranked only on the priorities you pick, from the figures below. Repayments assume a {a.depositPct}% deposit at {a.interestRatePct}% over {a.loanTermYears} years. Not financial
          advice.
        </p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Properties">
        {ordered.map(({ p, r }) => {
          const l = p.listing;
          const isBest = match.best?.id === l.id;
          const rent = r.annualRent.known ? r.annualRent.value / 52 : null;
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
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-slate-600">{r.priceSource === "estimate" ? "Estimated value" : r.priceSource === "user" ? "Your price" : "Price"}</dt>
                    <dd className="text-right font-display text-lg font-extrabold tabular-nums">{r.price.known ? formatAud(r.price.value) : "Unknown"}</dd>
                  </div>
                  {r.priceSource === "estimate" && p.estimate ? (
                    <p className="-mt-1 text-right text-xs text-slate-500">
                      Range {formatAud(p.estimate.value_low)}–{formatAud(p.estimate.value_high)}
                      {p.estimate.is_demo ? " (DEMO)" : ""}. Not a price.
                    </p>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-slate-600">Estimated repayments</dt>
                    <dd className="tabular-nums">{r.annualRepayments.known ? `${formatAud(r.annualRepayments.value / 12)}/month` : "Unknown"}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-slate-600">Rental potential</dt>
                    <dd className="text-right tabular-nums">
                      {rent != null ? (
                        <>
                          {formatAud(rent)}/week
                          <span className="block text-xs text-slate-500">
                            {r.grossYield.known ? `${formatRatio(r.grossYield.value)} gross yield · ` : ""}
                            {p.facts.rentSource === "estimate" ? `estimate${p.estimate?.is_demo ? " (DEMO)" : ""}` : "listing assumption"}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">Unknown</span>
                      )}
                    </dd>
                  </div>
                </dl>
                {(match.ranking.find((x) => x.id === l.id)?.wins ?? []).length ? (
                  <p className="flex flex-wrap gap-1">
                    {match.ranking
                      .find((x) => x.id === l.id)!
                      .wins.map((w) => (
                        <span key={w} className="rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf-800">
                          {PRIORITIES[w].label}
                        </span>
                      ))}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="quick-assumptions" className="flex flex-wrap items-end gap-3 rounded-2xl border border-sand-200 bg-white p-4">
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
