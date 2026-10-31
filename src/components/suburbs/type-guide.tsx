"use client";

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { LineChart } from "@/components/compare/charts";
import { formatAud, formatDate, formatRatio } from "@/lib/format";
import { sampleNote, type TypeProfile } from "@/lib/suburbs/stats";

const TITLE = { house: "House price guide", unit: "Unit and apartment price guide" } as const;
const WORD = { house: "houses", unit: "units" } as const;

const monthYear = (iso: string) => new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const windowLabel = (endIso: string) => {
  const end = new Date(endIso);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  return `${monthYear(start.toISOString())} – ${monthYear(endIso)}`;
};

function Sample({ count }: { count: number }) {
  const n = sampleNote(count);
  return <span className={`block text-xs ${n.level === "ok" ? "text-slate-500" : "font-semibold text-amber-800"}`}>{n.label}</span>;
}

function Tile({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-sand-200 p-4">
      <p className={`font-display text-2xl font-extrabold ${value === "Not available" ? "text-base text-slate-500" : ""}`}>{value}</p>
      <p className="text-sm text-slate-700">{label}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

/** One dwelling type's section of a suburb profile. Every figure shows the sales behind it. */
export function TypeGuide({ p, demo }: { p: TypeProfile; demo: boolean }) {
  const m = p.median;
  const c = p.change12;
  const up = c ? c.change >= 0 : true;
  return (
    <section aria-labelledby={`${p.type}-guide`} className="overflow-hidden rounded-3xl border border-sand-200 bg-white">
      <h2 id={`${p.type}-guide`} className="border-b border-sand-200 px-5 py-4 font-display text-xl font-bold">
        {TITLE[p.type]}
      </h2>
      <div className="space-y-6 p-5">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1 text-sm text-slate-600">
              Median sale price <Info aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="sr-only">: the middle sale price of {WORD[p.type]} sold in the 12 months shown</span>
            </p>
            {m?.median != null ? (
              <>
                <p className="font-display text-4xl font-extrabold tabular-nums">{formatAud(m.median)}</p>
                <p className="text-sm text-slate-500">{windowLabel(m.periodEnd)}</p>
                <Sample count={m.count} />
              </>
            ) : (
              <p className="mt-1 text-slate-500">No {WORD[p.type]} sold in the past 12 months.</p>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-600">Past 12-month change</p>
            {c ? (
              <>
                <p className={`flex items-center gap-1 font-display text-2xl font-extrabold ${up ? "text-leaf-700" : "text-red-700"}`}>
                  {up ? <ArrowUpRight aria-hidden="true" className="h-6 w-6" /> : <ArrowDownRight aria-hidden="true" className="h-6 w-6" />}
                  {up ? "Up" : "Down"} {formatRatio(Math.abs(c.change))}
                </p>
                <p className="text-xs text-slate-500">
                  {formatAud(c.from)} → {formatAud(c.to)} · {c.fromCount} sales the year before, {c.toCount} this year
                </p>
                {Math.min(c.fromCount, c.toCount) < 12 ? (
                  <p className="mt-1 text-xs font-semibold text-amber-800">Few sales: one or two unusual sales can move this a lot.</p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-slate-500">Can&apos;t be calculated: no sales in one of the two periods.</p>
            )}
          </div>
        </div>

        {p.growth.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="mb-2 text-left font-semibold">Historical growth (median, per year)</caption>
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    Period
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    Per year
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    Median then → now
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Sales then / now
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.growth.map((g) => (
                  <tr key={g.years} className="border-t border-sand-100">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      {g.years} year{g.years === 1 ? "" : "s"}
                    </th>
                    <td className={`py-1.5 pr-3 font-semibold tabular-nums ${g.perYear >= 0 ? "text-leaf-700" : "text-red-700"}`}>{formatRatio(g.perYear)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {formatAud(g.from)} → {formatAud(g.to)}
                    </td>
                    <td className="py-1.5 tabular-nums">
                      {g.fromCount} / {g.toCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {p.trend.filter((t) => t.median != null).length > 1 ? (
          <LineChart
            title={`5-year median price trend (rolling 12 months)${demo ? ", DEMO" : ""}`}
            valueLabel="median sale price"
            series={[{ id: p.type, label: `Median (${WORD[p.type]})`, color: p.type === "house" ? "#2a78d6" : "#1baf7a" }]}
            data={[p.trend.filter((t) => t.median != null).map((t) => ({ year: Number(t.periodEnd.slice(0, 4)) + (Number(t.periodEnd.slice(5, 7)) - 1) / 12, value: t.median! }))]}
            xFormat={(x) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Math.round((x % 1) * 12) % 12]} '${String(Math.floor(x + 1e-9)).slice(2)}`}
          />
        ) : null}

        <div>
          <h3 className="font-display text-lg font-bold">Market insights for {WORD[p.type]}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Tile value={m ? `${m.count} sold` : "0 sold"} label="in the past 12 months" note="Settled sales" />
            <Tile
              value={p.yield != null ? formatRatio(p.yield) : "Unknown"}
              label="gross rental yield"
              note={p.yield != null && p.rent ? `Median rent ${formatAud(p.rent.medianWeekly!)}/week × 52 ÷ median price` : "Needs both a median rent and a median price"}
            />
            <Tile
              value={p.rent?.medianWeekly != null ? `${formatAud(p.rent.medianWeekly)}/wk` : "Unknown"}
              label="median weekly rent"
              note={p.rent ? `Quarter to ${formatDate(p.rent.periodEnd)} · ${p.rent.count} new bonds` : undefined}
            />
            <Tile value="Not available" label="listings, days on market, buyer interest" note="Needs a listings data partner" />
          </div>
        </div>

        {p.bedrooms.length ? (
          <div>
            <h3 className="font-display text-lg font-bold">Median price by bedrooms</h3>
            <ul className="mt-2 divide-y divide-sand-100 rounded-2xl border border-sand-200">
              {p.bedrooms.map((b) => (
                <li key={b.bedrooms} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    {b.bedrooms} bed {p.type}
                  </span>
                  <span className="text-right">
                    {b.median != null ? <strong className="tabular-nums">{formatAud(b.median)}</strong> : <span className="text-slate-500">Unavailable</span>}
                    <Sample count={b.count} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
