"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { LineChart } from "@/components/compare/charts";
import { formatAud, formatRatio } from "@/lib/format";
import { countText, quarterLabel, type OfficialType, type Published } from "@/lib/official/postcode";

const TITLE = { house: "Houses (non-strata)", unit: "Units and townhouses (strata)" } as const;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function NotPublished({ p }: { p: Published }) {
  return <span className="text-slate-500">Not published by NSW DCJ ({countText(p)})</span>;
}

function Change({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <p className="text-sm text-slate-500">{label}: not published</p>;
  const up = value >= 0;
  return (
    <p className={`flex items-center gap-1 font-display text-xl font-extrabold ${up ? "text-leaf-700" : "text-red-700"}`}>
      {up ? <ArrowUpRight aria-hidden="true" className="h-5 w-5" /> : <ArrowDownRight aria-hidden="true" className="h-5 w-5" />}
      {up ? "Up" : "Down"} {formatRatio(Math.abs(value))}
      <span className="ml-1 text-sm font-normal text-slate-500">{label}</span>
    </p>
  );
}

/** One dwelling group from the NSW Rent and Sales Report, exactly as published (plus SitePilot's growth maths). */
export function OfficialGuide({ t, postcode }: { t: OfficialType; postcode: string }) {
  const l = t.latest;
  const trend = t.trend.filter((p) => p.median != null);
  return (
    <section aria-labelledby={`official-${t.type}`} className="overflow-hidden rounded-3xl border border-sand-200 bg-white">
      <h2 id={`official-${t.type}`} className="border-b border-sand-200 px-5 py-4 font-display text-xl font-bold">
        {TITLE[t.type]}
      </h2>
      <div className="space-y-6 p-5">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-600">Median sale price</p>
            {l?.median != null ? (
              <>
                <p className="font-display text-4xl font-extrabold tabular-nums">{formatAud(l.median)}</p>
                <p className="text-sm text-slate-500">
                  {quarterLabel(l)} · {countText(l)}
                </p>
              </>
            ) : l ? (
              <p className="mt-1">
                <NotPublished p={l} />
              </p>
            ) : (
              <p className="mt-1 text-slate-500">No figures for postcode {postcode}.</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-600">Change in the median (as published)</p>
            <Change value={t.changeAnnual} label="on a year earlier" />
            <Change value={t.changeQuarterly} label="on the previous quarter" />
          </div>
        </div>

        {t.growth.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="mb-2 text-left font-semibold">Longer-term growth (per year, same quarter)</caption>
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
                {t.growth.map((g) => (
                  <tr key={g.years} className="border-t border-sand-100">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      {g.years} years
                    </th>
                    <td className={`py-1.5 pr-3 font-semibold tabular-nums ${g.perYear >= 0 ? "text-leaf-700" : "text-red-700"}`}>{formatRatio(g.perYear)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {formatAud(g.from.median!)} → {formatAud(g.to.median!)}
                    </td>
                    <td className="py-1.5">
                      {countText(g.from).replace(" sales", "")} / {countText(g.to).replace(" sales", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-slate-500">Calculated by SitePilot from DCJ&apos;s published quarterly medians. Historical, not a forecast.</p>
          </div>
        ) : null}

        {trend.length > 1 ? (
          <LineChart
            title={`Median sale price by quarter, postcode ${postcode}`}
            valueLabel="median sale price"
            series={[{ id: t.type, label: t.type === "house" ? "Houses" : "Units", color: t.type === "house" ? "#2a78d6" : "#1baf7a" }]}
            data={[trend.map((p) => ({ year: Number(p.periodEnd.slice(0, 4)) + (Number(p.periodEnd.slice(5, 7)) - 1) / 12, value: p.median! }))]}
            xFormat={(x) => `${MON[Math.round((x % 1) * 12) % 12]} '${String(Math.floor(x + 1e-9)).slice(2)}`}
          />
        ) : null}

        <div>
          <h3 className="font-display text-lg font-bold">Rent</h3>
          {t.rent ? (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-sand-200 p-4">
                <p className="font-display text-2xl font-extrabold">{t.rent.median != null ? `${formatAud(t.rent.median)}/wk` : "Not published"}</p>
                <p className="text-sm text-slate-700">median weekly rent, new bonds</p>
                <p className="mt-1 text-xs text-slate-500">
                  {quarterLabel(t.rent)} · {countText(t.rent).replace("sales", "new bonds").replace("sale", "new bond")}
                  {t.rent.changeAnnual != null ? ` · ${t.rent.changeAnnual >= 0 ? "up" : "down"} ${formatRatio(Math.abs(t.rent.changeAnnual))} on a year earlier` : ""}
                </p>
              </div>
              <div className="rounded-2xl border border-sand-200 p-4">
                <p className="font-display text-2xl font-extrabold">{t.yield != null ? formatRatio(t.yield) : "Unknown"}</p>
                <p className="text-sm text-slate-700">gross rental yield</p>
                <p className="mt-1 text-xs text-slate-500">Median rent × 52 ÷ median sale price (calculated by SitePilot; rent and sales quarters can differ).</p>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">No rent figures published for this group.</p>
          )}
          {t.rentByBedrooms.length ? (
            <ul className="mt-3 divide-y divide-sand-100 rounded-2xl border border-sand-200">
              {t.rentByBedrooms.map((b) => (
                <li key={b.bedrooms} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>{b.bedrooms}</span>
                  <span className="text-right">
                    {b.median != null ? <strong className="tabular-nums">{formatAud(b.median)}/wk</strong> : <span className="text-slate-500">Not published</span>}
                    <span className="block text-xs text-slate-500">{countText(b).replace("sales", "new bonds").replace("sale", "new bond")}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
