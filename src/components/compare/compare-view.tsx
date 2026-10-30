"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { analyseListing } from "@/app/(app)/analyse/actions";
import { deleteComparison, saveComparison, shareComparison, unshareComparison } from "@/app/(app)/compare/actions";
import { DemoTag, NotForSaleTag } from "@/components/discovery/listing-card";
import { ShareLink } from "@/components/vision/share-link";
import { DEFAULT_ASSUMPTIONS, SCENARIOS, type CompareAssumptions, type PropertyOverrides, type Scenario } from "@/lib/compare/assumptions";
import { evaluate, type Metric, type PropertyResult } from "@/lib/compare/engine";
import { explain, QUESTIONS, type Row } from "@/lib/compare/explain";
import { DEFAULT_PRIORITIES, type Priority } from "@/lib/compare/quick";
import type { CompareProperty } from "@/lib/compare/facts";
import { BANDS, CATEGORIES, CATEGORY_LABELS, DEFAULT_WEIGHTS, MIN_COVERAGE, scoreProperty, type Weights } from "@/lib/compare/score";
import type { CompareState } from "@/lib/compare/state";
import { formatAud, formatDate, formatRatio } from "@/lib/format";
import { BarChart, LineChart, SERIES } from "./charts";
import { NumberField, Segmented, Slider } from "./controls";
import { QuickCompare } from "./quick-compare";

const SCENARIO_LABEL: Record<Scenario, string> = { conservative: "Conservative", base: "Base", optimistic: "Optimistic" };
const button = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold";

const fmt = (m: Metric, f: (n: number) => string = formatAud) => (m.known ? f(m.value) : "Unknown");

function Cell({ m, f, note }: { m: Metric; f?: (n: number) => string; note?: string }) {
  return (
    <>
      <span className={m.known ? "tabular-nums" : "text-slate-500"}>{fmt(m, f)}</span>
      {!m.known ? <span className="block text-xs text-slate-500">{m.reason}</span> : note ? <span className="block text-xs text-slate-500">{note}</span> : null}
    </>
  );
}

export type CompareViewMode = "quick" | "advanced";

type Props = {
  initialView?: CompareViewMode;
  properties: CompareProperty[];
  initial: CompareState;
  setId?: string;
  signedIn: boolean;
  sharedAt?: string | null;
};

export function CompareView({ properties, initial, setId, signedIn, sharedAt, initialView = "quick" }: Props) {
  const router = useRouter();
  const [view, setView] = useState<CompareViewMode>(initialView);
  const [mode, setMode] = useState(initial.mode);
  const [priorities, setPriorities] = useState<Priority[]>(DEFAULT_PRIORITIES[initial.mode]);
  const [a, setA] = useState<CompareAssumptions>(initial.assumptions);
  const [weights, setWeights] = useState<Weights>(initial.weights);
  const [overrides, setOverrides] = useState<Record<string, PropertyOverrides>>(initial.overrides);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [name, setName] = useState(initial.name);
  const [question, setQuestion] = useState(QUESTIONS[0]!.id);
  const [status, setStatus] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const investor = mode === "investor";

  const series = properties.map((p, i) => ({ id: p.listing.id, label: p.listing.headline, color: SERIES[i]! }));
  const rows: (Row & { p: CompareProperty; r: PropertyResult })[] = useMemo(
    () =>
      properties.map((p) => {
        const r = evaluate(p.facts, a, overrides[p.listing.id]);
        return { id: p.listing.id, label: p.listing.headline, p, r, result: r, score: scoreProperty(p.facts, r, weights) };
      }),
    [properties, a, overrides, weights],
  );
  const lines = useMemo(() => explain(rows, a), [rows, a]);

  const set = <K extends keyof CompareAssumptions>(k: K, v: CompareAssumptions[K]) => setA((prev) => ({ ...prev, [k]: v }));
  const override = (id: string, k: keyof PropertyOverrides, v: number | undefined) =>
    setOverrides((prev) => {
      const next = { ...(prev[id] ?? {}) };
      if (v == null) delete next[k];
      else next[k] = v;
      return { ...prev, [id]: next };
    });

  const state: CompareState = { name, mode, listingIds: properties.map((p) => p.listing.id), assumptions: a, weights, overrides };
  const save = () =>
    startTransition(async () => {
      const res = await saveComparison(setId ?? null, state);
      if (!res.ok) return setStatus(res.error);
      setStatus("Saved.");
      if (!setId) router.push(`/compare/${res.id}?view=${view}`);
      else router.refresh();
    });

  const best = (pick: (r: (typeof rows)[number]) => number | null, dir: "max" | "min") => {
    const k = rows.map((r) => ({ r, v: pick(r) })).filter((x): x is { r: (typeof rows)[number]; v: number } => x.v != null);
    return k.length ? k.reduce((x, y) => ((dir === "max" ? y.v > x.v : y.v < x.v) ? y : x)) : null;
  };
  const summary = investor
    ? [
        { title: "Top Investment Match Score", b: best((r) => r.score.score, "max"), f: (v: number) => `${v}/100` },
        { title: "Best year-1 cash flow", b: best((r) => (r.r.cashFlowYear1.known ? r.r.cashFlowYear1.value : null), "max"), f: formatAud },
        { title: "Least cash up front", b: best((r) => (r.r.cashRequired.known ? r.r.cashRequired.value : null), "min"), f: formatAud },
      ]
    : [
        { title: "Lowest price or estimate", b: best((r) => (r.r.price.known ? r.r.price.value : null), "min"), f: formatAud },
        { title: "Lowest repayments", b: best((r) => (r.r.annualRepayments.known ? r.r.annualRepayments.value / 12 : null), "min"), f: (v: number) => `${formatAud(v)}/month` },
        { title: "Least cash up front", b: best((r) => (r.r.cashRequired.known ? r.r.cashRequired.value : null), "min"), f: formatAud },
      ];

  const th = "sticky left-0 z-10 w-40 min-w-[9rem] bg-white px-3 py-2 text-left align-top text-sm font-medium text-slate-700 shadow-[1px_0_0_#e7e5e4]";
  const td = "min-w-[11rem] px-3 py-2 align-top text-sm";
  const group = (label: string) => (
    <tr key={`group-${label}`}>
      <th colSpan={rows.length + 1} scope="colgroup" className="bg-sand-50 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
        <span className="sticky left-3">{label}</span>
      </th>
    </tr>
  );
  const row = (label: string, render: (r: (typeof rows)[number]) => React.ReactNode, hint?: string) => (
    <tr key={label} className="border-t border-sand-100">
      <th scope="row" className={th}>
        {label}
        {hint ? <span className="block text-xs font-normal text-slate-500">{hint}</span> : null}
      </th>
      {rows.map((r) => (
        <td key={r.id} className={td}>
          {render(r)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="View"
          value={view}
          onChange={(v) => {
            setView(v);
            const url = new URL(window.location.href);
            url.searchParams.set("view", v);
            window.history.replaceState(null, "", url);
          }}
          options={[
            { value: "quick", label: "Quick compare" },
            { value: "advanced", label: "Advanced" },
          ]}
        />
        {view === "advanced" ? (
          <Segmented
            label="Comparison preset"
            value={mode}
            onChange={setMode}
            options={[
              { value: "investor", label: "Investor" },
              { value: "homebuyer", label: "Homebuyer" },
            ]}
          />
        ) : null}
      </div>
      <p className="text-xs text-slate-500">Educational only: pre-tax, based on your assumptions. Not financial advice or a forecast.</p>

      {view === "quick" ? (
        <QuickCompare
          items={rows.map((r) => ({ p: r.p, r: r.r }))}
          assumptions={a}
          onAssumption={set}
          priorities={priorities}
          onPriorities={setPriorities}
          onAdvanced={() => {
            setView("advanced");
            const url = new URL(window.location.href);
            url.searchParams.set("view", "advanced");
            window.history.replaceState(null, "", url);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <>
      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        {summary.map((s) => (
          <div key={s.title} className="rounded-2xl border border-sand-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.title}</p>
            {s.b ? (
              <>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{s.f(s.b.v)}</p>
                <p className="mt-1 truncate text-sm text-slate-700">{s.b.r.label}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Not enough data yet</p>
            )}
          </div>
        ))}
      </section>

      <section aria-labelledby="table-heading" className="rounded-2xl border border-sand-200 bg-white">
        <h2 id="table-heading" className="px-4 pt-4 font-display text-lg font-bold">
          Side by side
        </h2>
        <p className="px-4 text-xs text-slate-500 sm:hidden">Swipe sideways to see every property.</p>
        <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Comparison table">
          <table className="w-full border-collapse">
            <caption className="sr-only">Properties compared side by side</caption>
            <thead>
              <tr>
                <td className={`${th} border-b border-sand-200`} />
                {rows.map((r, i) => (
                  <th key={r.id} scope="col" className="min-w-[11rem] border-b border-sand-200 px-3 py-3 text-left align-top">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: SERIES[i] }} />
                      <Link href={`/listings/${r.id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                        {r.label}
                      </Link>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {r.p.listing.is_demo ? <DemoTag /> : null}
                      {r.p.listing.market === "off_market" ? <NotForSaleTag /> : null}
                    </span>
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {r.p.listing.suburb} {r.p.listing.state}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investor ? (
                <>
                  {group("Score")}
                  {row("Investment Match Score", (r) =>
                    r.score.score != null ? (
                      <>
                        <span className="font-display text-xl font-extrabold tabular-nums">{r.score.score}</span>
                        <span className="text-slate-500">/100</span>
                        <span className="block text-xs text-slate-500">{Math.round(r.score.coverage * 100)}% of weight scored</span>
                      </>
                    ) : (
                      <span className="text-slate-500">
                        Not enough evidence to score
                        <span className="block text-xs">{Math.round(r.score.coverage * 100)}% of weight has evidence (needs {MIN_COVERAGE * 100}%)</span>
                      </span>
                    ),
                  )}
                  {CATEGORIES.map((c) =>
                    row(CATEGORY_LABELS[c], (r) => {
                      const comp = r.score.components.find((x) => x.category === c)!;
                      return comp.score != null ? (
                        <>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-20 overflow-hidden rounded-full bg-sand-100" aria-hidden="true">
                              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${comp.score}%` }} />
                            </span>
                            <span className="tabular-nums">{comp.score}</span>
                          </span>
                          <span className="block text-xs text-slate-500">{comp.reason}</span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">{comp.reason}</span>
                      );
                    }, `${weights[c]} weight`),
                  )}
                </>
              ) : null}

              {group("Property")}
              {row("Status", (r) => (r.p.listing.market === "off_market" ? "NOT FOR SALE" : "For sale"))}
              {row("Type", (r) => <span className="capitalize">{r.p.listing.property_type}</span>)}
              {row("Beds · baths · cars", (r) =>
                r.p.listing.property_type === "land" ? "Vacant land" : `${r.p.listing.bedrooms ?? "?"} · ${r.p.listing.bathrooms ?? "?"} · ${r.p.listing.car_spaces ?? "?"}`,
              )}
              {row("Land area", (r) => (r.p.listing.land_area_sqm ? `${r.p.listing.land_area_sqm.toLocaleString("en-AU")} m²` : <span className="text-slate-500">Unknown</span>))}
              {!investor ? row("Features", (r) => (r.p.listing.lifestyle_tags.length ? r.p.listing.lifestyle_tags.join(" · ") : <span className="text-slate-500">None listed</span>)) : null}
              {!investor ? row("Commute", () => <span className="text-slate-500">Not available: no supported route data yet</span>) : null}

              {group("Price and purchase costs")}
              {row(
                "Price or estimate",
                (r) => (
                  <Cell
                    m={r.r.price}
                    note={
                      r.r.priceSource === "listing"
                        ? `Asking price${r.p.listing.listed_on ? `, listed ${formatDate(r.p.listing.listed_on)}` : ""}`
                        : r.r.priceSource === "estimate" && r.p.estimate
                          ? `Estimated value (range ${formatAud(r.p.estimate.value_low)}–${formatAud(r.p.estimate.value_high)}, ${r.p.estimate.confidence} confidence${r.p.estimate.is_demo ? ", DEMO" : ""}). Not a price.`
                          : r.r.priceSource === "user"
                            ? "Your hypothetical figure"
                            : undefined
                    }
                  />
                ),
              )}
              {row(
                "Your price (optional)",
                (r) => (
                  <NumberField
                    compact
                    label={`${r.p.listing.market === "off_market" ? "Hypothetical price" : "Your price"} for ${r.label}`}
                    prefix="$"
                    allowEmpty
                    min={1}
                    max={1_000_000_000}
                    placeholder={r.p.listing.market === "off_market" ? "Hypothetical" : "Use listing"}
                    value={overrides[r.id]?.price}
                    onChange={(v) => override(r.id, "price", v)}
                  />
                ),
                "Overrides the listing or estimate",
              )}
              {row("Stamp duty", (r) => (
                <>
                  <Cell
                    m={r.r.stampDuty}
                    note={
                      overrides[r.id]?.stampDuty != null
                        ? "Your figure"
                        : r.p.duty
                          ? `${r.p.listing.state} rates as of ${formatDate(r.p.duty.as_of)}${r.p.duty.status === "needs_review" ? " (needs review)" : ""}`
                          : undefined
                    }
                  />
                  <div className="mt-1">
                    <NumberField compact label={`Stamp duty for ${r.label}`} prefix="$" allowEmpty min={0} max={100_000_000} placeholder="Enter estimate" value={overrides[r.id]?.stampDuty} onChange={(v) => override(r.id, "stampDuty", v)} />
                  </div>
                </>
              ), "Use your state's official calculator")}
              {row("Cash required", (r) => <Cell m={r.r.cashRequired} />, `${a.depositPct}% deposit + duty + other costs`)}
              {row("Loan", (r) => <Cell m={r.r.loan} />)}
              {row(
                investor ? "Repayments (year 1)" : "Repayments per month",
                (r) => <Cell m={investor ? r.r.annualRepayments : r.r.annualRepayments.known ? { known: true, value: r.r.annualRepayments.value / 12 } : r.r.annualRepayments} />,
                `${a.interestRatePct}%, ${a.repayment === "interest_only" ? "interest only" : `P&I over ${a.loanTermYears} years`}`,
              )}

              {investor ? (
                <>
                  {group("Rent, yield and cash flow")}
                  {row("Weekly rent", (r) => (
                    <>
                      <Cell
                        m={overrides[r.id]?.weeklyRent ?? r.p.facts.weeklyRent ? { known: true, value: (overrides[r.id]?.weeklyRent ?? r.p.facts.weeklyRent)! } : { known: false, reason: "No rent estimate" }}
                        note={overrides[r.id]?.weeklyRent ? "Your figure" : r.p.facts.rentSource === "listing" ? "Listing assumption" : r.p.facts.rentSource === "estimate" ? `Estimated rent${r.p.estimate?.is_demo ? " (DEMO)" : ""}` : undefined}
                      />
                      <div className="mt-1">
                        <NumberField compact label={`Weekly rent for ${r.label}`} prefix="$" allowEmpty min={1} max={100_000} placeholder="Your rent" value={overrides[r.id]?.weeklyRent} onChange={(v) => override(r.id, "weeklyRent", v)} />
                      </div>
                    </>
                  ))}
                  {row("Gross yield", (r) => <Cell m={r.r.grossYield} f={(n) => formatRatio(n)} />, "Annual rent ÷ price")}
                  {row("Net yield", (r) => <Cell m={r.r.netYield} f={(n) => formatRatio(n)} />, "After vacancy and costs, before finance")}
                  {row("Running costs (year 1)", (r) => <Cell m={r.r.operatingCosts} />)}
                  {row("Cash flow (year 1)", (r) => <Cell m={r.r.cashFlowYear1} />, "Pre-tax, after repayments")}
                  {[1, 2].map((pp) => row(`Cash flow at +${pp}% rates`, (r) => <Cell m={r.r.rateSensitivity.find((s) => s.shiftPp === pp)!.cashFlow} />))}

                  {group(`${SCENARIO_LABEL[scenario]} scenario over ${a.holdingYears} years`)}
                  {row("Value at the end", (r) => (r.r.projections ? formatAud(r.r.projections[scenario].endValue) : <span className="text-slate-500">Unknown</span>), `${a.growthPct[scenario]}% a year (your assumption)`)}
                  {row("Unrealised capital gain", (r) => (r.r.projections ? formatAud(r.r.projections[scenario].unrealisedGain) : <span className="text-slate-500">Unknown</span>), "Not cash: only if sold")}
                  {row("Cumulative cash flow", (r) => (r.r.projections ? <Cell m={r.r.projections[scenario].cumulativeCashFlow} /> : <span className="text-slate-500">Unknown</span>))}
                  {row("Net return", (r) => (r.r.projections ? <Cell m={r.r.projections[scenario].netReturn} /> : <span className="text-slate-500">Unknown</span>), "Equity + cash flow − cash put in")}
                </>
              ) : null}

              {group("Development and risk")}
              {row("Development", (r) => <DevelopmentCell p={r.p} signedIn={signedIn} />)}
              {row("Open checks", (r) => (r.p.listing.risk_flags.length ? <ul className="list-disc space-y-1 pl-4 text-xs">{r.p.listing.risk_flags.map((f) => <li key={f}>{f}</li>)}</ul> : <span className="text-slate-500">None listed</span>))}
              {row("Environmental risk", () => <span className="text-xs text-slate-500">Unknown: no licensed hazard data yet</span>)}
              {row("Price history", () => <span className="text-xs text-slate-500">Unknown: no licensed price history yet</span>)}

              {group("Sources")}
              {row("Listing data", (r) => {
                const prov = (r.p.listing.provenance ?? {}) as Record<string, unknown>;
                return (
                  <span className="text-xs text-slate-600">
                    {String(prov.source ?? "Unknown")} · as of {String(prov.as_of ?? "unknown")} · {String(prov.verification ?? "unverified")}
                  </span>
                );
              })}
              {row("Estimate", (r) =>
                r.p.estimate ? (
                  <span className="text-xs text-slate-600">
                    {r.p.estimate.source} · as of {formatDate(r.p.estimate.as_of)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">None (needs a licensed valuation provider)</span>
                ),
              )}
              {row("Completeness", (r) => `${Math.round(r.p.facts.completeness * 100)}%`)}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="charts-heading" className="space-y-6 rounded-2xl border border-sand-200 bg-white p-4">
          <h2 id="charts-heading" className="font-display text-lg font-bold">
            Charts
          </h2>
          {investor ? <BarChart title="Cash flow in year 1 (pre-tax)" series={series} values={rows.map((r) => (r.r.cashFlowYear1.known ? r.r.cashFlowYear1.value : null))} /> : null}
          <div className="space-y-2">
            <Segmented label="Growth scenario" value={scenario} onChange={setScenario} options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))} />
            <LineChart
              title={`Equity over ${a.holdingYears} years: ${SCENARIO_LABEL[scenario].toLowerCase()} scenario (${a.growthPct[scenario]}% a year, your assumption)`}
              valueLabel="equity"
              series={series}
              data={rows.map((r) => (r.r.projections ? r.r.projections[scenario].years.map((y) => ({ year: y.year, value: y.equity })) : null))}
            />
          </div>
        </section>

        <section aria-labelledby="why-heading" className="space-y-4 rounded-2xl border border-sand-200 bg-white p-4">
          <h2 id="why-heading" className="font-display text-lg font-bold">
            Why these results?
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            {(investor ? lines : lines.slice(1)).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-sand-100 pt-3">
            <label htmlFor="question" className="text-sm font-medium">
              Ask a question
            </label>
            <select id="question" value={question} onChange={(e) => setQuestion(e.target.value)} className="block min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm">
              {QUESTIONS.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.question}
                </option>
              ))}
            </select>
            <p className="rounded-xl bg-brand-50 p-3 text-sm" aria-live="polite">
              {QUESTIONS.find((q) => q.id === question)!.answer(rows, a)}
            </p>
            <p className="text-xs text-slate-500">Answers are calculated from your assumptions, not predicted.</p>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="assumptions-heading" className="space-y-4 rounded-2xl border border-sand-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="assumptions-heading" className="font-display text-lg font-bold">
              Your assumptions
            </h2>
            <button type="button" onClick={() => setA(DEFAULT_ASSUMPTIONS)} className={`${button} border border-sand-300 bg-white`}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" /> Reset
            </button>
          </div>
          <p className="text-xs text-slate-500">Starting values are examples, the same for every property. They are not forecasts.</p>
          <Slider label="Interest rate" min={0} max={15} step={0.05} value={a.interestRatePct} onChange={(v) => set("interestRatePct", v)} format={(v) => `${v.toFixed(2)}%`} />
          <Slider label="Holding period" min={1} max={30} value={a.holdingYears} onChange={(v) => set("holdingYears", v)} format={(v) => `${v} years`} />
          {SCENARIOS.map((s) => (
            <Slider key={s} label={`${SCENARIO_LABEL[s]} growth`} min={-5} max={12} step={0.5} value={a.growthPct[s]} onChange={(v) => set("growthPct", { ...a.growthPct, [s]: v })} format={(v) => `${v}% a year`} />
          ))}
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Deposit" suffix="%" min={0} max={100} step={0.5} value={a.depositPct} onChange={(v) => v != null && set("depositPct", v)} />
            <NumberField label="Loan term" suffix="years" min={1} max={40} value={a.loanTermYears} onChange={(v) => v != null && set("loanTermYears", v)} />
            <label className="col-span-2 block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Repayments</span>
              <select value={a.repayment} onChange={(e) => set("repayment", e.target.value as CompareAssumptions["repayment"])} className="block min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm">
                <option value="principal_and_interest">Principal and interest</option>
                <option value="interest_only">Interest only</option>
              </select>
            </label>
            <NumberField label="Other purchase costs" prefix="$" min={0} max={10_000_000} value={a.otherPurchaseCosts} onChange={(v) => v != null && set("otherPurchaseCosts", v)} />
            <NumberField label="Vacancy" suffix="%" min={0} max={100} step={0.5} value={a.vacancyPct} onChange={(v) => v != null && set("vacancyPct", v)} />
            <NumberField label="Management" suffix="% of rent" min={0} max={30} step={0.5} value={a.managementPct} onChange={(v) => v != null && set("managementPct", v)} />
            <NumberField label="Insurance a year" prefix="$" min={0} max={1_000_000} value={a.insurance} onChange={(v) => v != null && set("insurance", v)} />
            <NumberField label="Council rates a year" prefix="$" min={0} max={1_000_000} value={a.councilRates} onChange={(v) => v != null && set("councilRates", v)} />
            <NumberField label="Strata a year" prefix="$" min={0} max={1_000_000} value={a.strata} onChange={(v) => v != null && set("strata", v)} />
            <NumberField label="Maintenance a year" prefix="$" min={0} max={1_000_000} value={a.maintenance} onChange={(v) => v != null && set("maintenance", v)} />
            <NumberField label="Land tax a year" prefix="$" min={0} max={10_000_000} value={a.landTax} onChange={(v) => v != null && set("landTax", v)} />
            <NumberField label="Rent growth" suffix="% a year" min={-10} max={20} step={0.5} value={a.rentGrowthPct} onChange={(v) => v != null && set("rentGrowthPct", v)} />
            <NumberField label="Cost growth" suffix="% a year" min={-10} max={20} step={0.5} value={a.expenseGrowthPct} onChange={(v) => v != null && set("expenseGrowthPct", v)} />
          </div>
          <p className="text-xs text-slate-500">Tax, depreciation and CGT aren&apos;t modelled. Ask an accountant about your situation.</p>
        </section>

        {investor ? (
          <section aria-labelledby="weights-heading" className="space-y-4 rounded-2xl border border-sand-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="weights-heading" className="font-display text-lg font-bold">
                Score weights
              </h2>
              <button type="button" onClick={() => setWeights(DEFAULT_WEIGHTS)} className={`${button} border border-sand-300 bg-white`}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" /> Reset
              </button>
            </div>
            {CATEGORIES.map((c) => (
              <Slider key={c} label={CATEGORY_LABELS[c]} min={0} max={50} value={weights[c]} onChange={(v) => setWeights((w) => ({ ...w, [c]: v }))} format={(v) => String(v)} />
            ))}
            <details className="text-sm">
              <summary className="cursor-pointer text-brand-700 underline">How the score works</summary>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                <p>
                  Each category is scored 0–100 on a fixed band, then averaged using your weights. Categories without evidence are left out (never counted as zero), and
                  no overall score is shown unless at least {MIN_COVERAGE * 100}% of the weight has evidence.
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  {Object.values(BANDS).map((b) => (
                    <li key={b.label}>{b.label}</li>
                  ))}
                </ul>
                <p>It isn&apos;t a prediction of capital growth or personal financial advice.</p>
              </div>
            </details>
          </section>
        ) : null}
      </div>

        </>
      )}

      <section aria-labelledby="save-heading" className="space-y-3 rounded-2xl border border-sand-200 bg-white p-4">
        <h2 id="save-heading" className="font-display text-lg font-bold">
          {setId ? "This comparison" : "Save this comparison"}
        </h2>
        {signedIn ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[12rem] flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="block min-h-11 w-full rounded-xl border border-sand-300 px-3" />
              </label>
              <button type="button" onClick={save} disabled={pending} className={`${button} bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60`}>
                {pending ? "Saving…" : setId ? "Save changes" : "Save comparison"}
              </button>
              {setId ? (
                <>
                  {sharedAt ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await unshareComparison(setId);
                          setShareToken(null);
                          router.refresh();
                        })
                      }
                      className={`${button} border border-sand-300 bg-white`}
                    >
                      Stop sharing
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const saved = await saveComparison(setId, state);
                          if (!saved.ok) return setStatus(saved.error);
                          const res = await shareComparison(setId);
                          if (res.ok) setShareToken(res.token);
                          else setStatus(res.error);
                          router.refresh();
                        })
                      }
                      className={`${button} border border-sand-300 bg-white`}
                    >
                      Create share link
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deleteComparison(setId);
                        if (res.ok) router.push("/saved?kind=investment");
                      })
                    }
                    className={`${button} border border-red-300 bg-white text-red-700`}
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
            {shareToken ? (
              <div role="status" className="rounded-2xl bg-leaf-50 p-3 text-sm">
                <p className="font-semibold">Share link created. Copy it now; we only show it once.</p>
                <ShareLink path={`/compare/shared/${shareToken}`} />
                <p className="mt-1 text-xs text-slate-600">It shows a frozen copy of these figures with suburb-level locations only. Stop sharing to turn it off.</p>
              </div>
            ) : sharedAt ? (
              <p className="text-sm text-slate-600">Shared since {formatDate(sharedAt)}. The link shows a frozen copy from that time.</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm">
            <Link href={`/sign-in?next=${encodeURIComponent(`/compare?ids=${state.listingIds.join(",")}`)}`} className="font-semibold text-brand-700 underline">
              Sign in to save
            </Link>{" "}
            and come back to it later. Nothing you enter here is stored.
          </p>
        )}
        {status ? (
          <p role="status" className="text-sm text-slate-700">
            {status}
          </p>
        ) : null}
      </section>
    </div>
  );
}

/** Development feasibility for one property: linked workspace status, or a way to start one (C6). */
function DevelopmentCell({ p, signedIn }: { p: CompareProperty; signedIn: boolean }) {
  const d = p.development;
  const idea = p.listing.development_idea ? <span className="block text-xs text-slate-600">Idea: {p.listing.development_idea}.</span> : null;
  if (d) {
    return (
      <div className="space-y-1 text-xs">
        {idea}
        {d.roi != null ? (
          <span className="block font-semibold text-leaf-700">
            Scenario &ldquo;{d.scenario?.name}&rdquo;: {formatRatio(d.roi)} return on cost
          </span>
        ) : (
          <span className="block text-slate-600">Not scored yet: {d.missing.join("; ")}.</span>
        )}
        <span className="block text-slate-500">
          {d.verifiedOfficial} verified planning record{d.verifiedOfficial === 1 ? "" : "s"}
          {p.listing.is_demo ? " · DEMO property: your own entries, not official data" : ""}
        </span>
        <Link href={`/investor/properties/${d.workspaceId}`} className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">
          Open workspace
        </Link>
      </div>
    );
  }
  if (p.listing.market !== "for_sale") {
    return (
      <span className="text-xs text-slate-600">
        {idea}Not assessed: this home isn&apos;t for sale.
      </span>
    );
  }
  return (
    <div className="space-y-1 text-xs">
      {idea}
      <span className="block text-slate-600">Not assessed: needs verified planning evidence and your scenario.</span>
      {signedIn ? (
        <form action={analyseListing}>
          <input type="hidden" name="listingId" value={p.listing.id} />
          <button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-3 font-semibold hover:bg-sand-100">
            Analyse this deal
          </button>
        </form>
      ) : null}
    </div>
  );
}
