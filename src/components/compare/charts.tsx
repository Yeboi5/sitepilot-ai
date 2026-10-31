"use client";

import { useState } from "react";
import { formatAud, formatAudCompact } from "@/lib/format";

/**
 * Categorical slots in fixed order (validated: adjacent CVD ΔE ≥ 9.1, normal-vision ≥ 19.6 on the
 * light surface). Three slots are under 3:1 contrast, so every chart has direct labels and a table.
 * Colour follows the property's position in the comparison, never its rank.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;

export type Series = { id: string; label: string; color: string };

function niceStep(range: number) {
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
}

function ticks(min: number, max: number) {
  const step = niceStep(max - min || 1);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v));
  return out;
}

/** Horizontal bars from a zero baseline (cash flow can be negative). */
export function BarChart({ title, series, values, format = formatAud }: { title: string; series: Series[]; values: (number | null)[]; format?: (v: number) => string }) {
  const known = values.filter((v): v is number => v != null);
  if (!known.length) return null;
  const t = ticks(Math.min(0, ...known), Math.max(0, ...known));
  const [lo, hi] = [t[0]!, t.at(-1)!];
  const W = 640;
  const left = 150;
  const right = 90;
  const rowH = 40;
  const H = series.length * rowH + 30;
  const x = (v: number) => left + ((v - lo) / (hi - lo || 1)) * (W - left - right);
  return (
    <figure className="space-y-2">
      <figcaption className="font-semibold">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Values are in the table below.`} className="w-full">
        {t.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={0} y2={H - 24} stroke={v === 0 ? "#64748b" : "#e7e5e4"} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={x(v)} y={H - 6} textAnchor="middle" fontSize={12} fill="#64748b">
              {formatAudCompact(v)}
            </text>
          </g>
        ))}
        {series.map((s, i) => {
          const v = values[i];
          const y = i * rowH + 8;
          const label = s.label.length > 22 ? `${s.label.slice(0, 21)}…` : s.label;
          return (
            <g key={s.id}>
              <title>{`${s.label}: ${v == null ? "Unknown" : format(v)}`}</title>
              <text x={left - 8} y={y + 16} textAnchor="end" fontSize={12} fill="#334155">
                {label}
              </text>
              {v == null ? (
                <text x={x(0) + 6} y={y + 16} fontSize={12} fill="#64748b">
                  Unknown
                </text>
              ) : (
                <>
                  <rect x={Math.min(x(0), x(v))} y={y + 4} width={Math.max(2, Math.abs(x(v) - x(0)))} height={20} rx={4} fill={s.color} />
                  <text x={v >= 0 ? x(v) + 6 : x(0) + 6} y={y + 18} fontSize={12} fill="#0f172a">
                    {format(v)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** One line per property over the holding period, with a hover crosshair and a table view. */
export function LineChart({
  title,
  series,
  data,
  valueLabel,
  xFormat,
}: {
  title: string;
  series: Series[];
  data: ({ year: number; value: number }[] | null)[];
  valueLabel: string;
  /** Labels for x values that aren't whole years (e.g. monthly points); also drops the $0 baseline. */
  xFormat?: (x: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const all = data.flatMap((d) => d ?? []);
  if (!all.length) return null;
  const years = [...new Set(all.map((p) => p.year))].sort((a, b) => a - b);
  const t = ticks(xFormat ? Math.min(...all.map((p) => p.value)) : Math.min(0, ...all.map((p) => p.value)), Math.max(...all.map((p) => p.value)));
  const label = (x: number) => (xFormat ? xFormat(x) : `Yr ${x}`);
  const fs = xFormat ? 17 : 12;
  // About five evenly spaced x labels for monthly series; first, last and every 5th year otherwise.
  const step = Math.max(1, Math.round((years.length - 1) / 4));
  const showTick = (x: number, i: number) => (xFormat ? i % step === 0 || i === years.length - 1 : x === years[0] || x === years.at(-1) || x % 5 === 0);
  const [lo, hi] = [t[0]!, t.at(-1)!];
  const W = 640;
  const H = 280;
  const pad = { l: 64, r: 120, t: 12, b: 28 };
  const x = (yr: number) => pad.l + ((yr - years[0]!) / Math.max(1, years.at(-1)! - years[0]!)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const lastYear = years.at(-1)!;
  // Direct end labels, nudged apart so they don't collide.
  const ends = series
    .map((s, i) => ({ s, v: data[i]?.find((p) => p.year === lastYear)?.value }))
    .filter((e): e is { s: Series; v: number } => e.v != null)
    .sort((a, b) => b.v - a.v);
  let prev = -Infinity;
  const placed = ends.map((e) => {
    const py = Math.max(y(e.v), prev + 14);
    prev = py;
    return { ...e, py };
  });
  return (
    <figure className="space-y-2">
      <figcaption className="font-semibold">{title}</figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}. Values are in the table below the chart.`}
          className="w-full touch-pan-y"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            setHover(years.reduce((best, yr) => (Math.abs(x(yr) - px) < Math.abs(x(best) - px) ? yr : best), years[0]!));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {t.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e7e5e4" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={fs} fill="#64748b">
                {formatAudCompact(v)}
              </text>
            </g>
          ))}
          {years.map((yr, i) =>
            showTick(yr, i) ? (
              <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" fontSize={fs} fill="#64748b">
                {label(yr)}
              </text>
            ) : null,
          )}
          {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#94a3b8" strokeDasharray="3 3" /> : null}
          {series.map((s, i) =>
            data[i] ? (
              <g key={s.id}>
                <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" points={data[i]!.map((p) => `${x(p.year)},${y(p.value)}`).join(" ")} />
                {hover != null && data[i]!.find((p) => p.year === hover) ? (
                  <circle cx={x(hover)} cy={y(data[i]!.find((p) => p.year === hover)!.value)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
                ) : null}
              </g>
            ) : null,
          )}
          {placed.map((e) => (
            <g key={e.s.id}>
              <circle cx={W - pad.r + 8} cy={e.py - 4} r={4} fill={e.s.color} />
              <text x={W - pad.r + 16} y={e.py} fontSize={fs} fill="#0f172a">
                {e.s.label.length > 14 ? `${e.s.label.slice(0, 13)}…` : e.s.label}
              </text>
            </g>
          ))}
        </svg>
        {hover != null ? (
          <div className="pointer-events-none absolute left-2 top-2 rounded-xl border border-sand-200 bg-white/95 p-2 text-xs shadow" role="status">
            <p className="font-semibold">{xFormat ? xFormat(hover) : `Year ${hover}`}</p>
            {series.map((s, i) => {
              const p = data[i]?.find((d) => d.year === hover);
              return p ? (
                <p key={s.id} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}: {formatAud(p.value)}
                </p>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700" aria-label="Legend">
        {series.map((s, i) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.label}
            {data[i] ? null : " (unknown)"}
          </li>
        ))}
      </ul>
      <details className="text-sm">
        <summary className="cursor-pointer text-brand-700 underline">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="text-xs">
            <caption className="sr-only">
              {title}: {valueLabel} by year
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1 text-left">
                  {xFormat ? "Period" : "Year"}
                </th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="px-2 py-1 text-right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((yr) => (
                <tr key={yr} className="border-t border-sand-100">
                  <th scope="row" className="px-2 py-1 text-left font-normal">
                    {xFormat ? xFormat(yr) : yr}
                  </th>
                  {series.map((s, i) => {
                    const p = data[i]?.find((d) => d.year === yr);
                    return (
                      <td key={s.id} className="px-2 py-1 text-right tabular-nums">
                        {p ? formatAud(p.value) : "Unknown"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
