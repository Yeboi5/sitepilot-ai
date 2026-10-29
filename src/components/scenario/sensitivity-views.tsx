import { Card } from "@/components/ui";
import { formatAud, formatAudCompact, formatAudDelta, formatRatio } from "@/lib/format";
import type { Sensitivity, SensitivityCase } from "@/lib/finance/sensitivity";

// Diverging pair validated with the dataviz palette checker (light surface): blue = better than
// break-even / base, red = worse. Neutral midpoint is gray. Sign is also carried by +/− labels
// and bar direction, so colour is never the only cue.
const POSITIVE = "#2a78d6";
const NEGATIVE = "#e34948";
const NEUTRAL = "#f0efec";

function mix(hex: string, amount: number) {
  // Blend toward white so dark text stays readable on every cell (amount 0..1, capped at 0.45).
  const a = Math.min(Math.max(amount, 0), 1) * 0.45;
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(255 + (((n >> shift) & 255) - 255) * a);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function cellColour(value: number, maxAbs: number) {
  if (maxAbs === 0 || Math.round(value) === 0) return NEUTRAL;
  return mix(value > 0 ? POSITIVE : NEGATIVE, 0.25 + 0.75 * (Math.abs(value) / maxAbs));
}

const pct = (n: number) => (n === 0 ? "Base" : `${n > 0 ? "+" : "−"}${Math.abs(n)}%`);

export function SensitivityMatrix({ data }: { data: Sensitivity }) {
  const cells = data.matrix.flat();
  const maxAbs = Math.max(...cells.map((c) => Math.abs(c.headline)));
  const metricLabel = data.metric === "margin" ? "Margin" : "Uplift minus costs";
  const secondary = (c: SensitivityCase) =>
    data.metric === "margin" ? `ROI ${formatRatio(c.roi)}` : `Yield ${formatRatio(c.yieldOnIncrementalCost)}`;

  return (
    <Card className="overflow-x-auto">
      <h2 className="font-semibold">Sensitivity: construction cost × end value</h2>
      <p className="mt-1 text-sm text-slate-600">
        {metricLabel} when the build cost and the assumed end value move ±15%. Blue is a gain, red a loss; the outlined
        cell is your base case.
      </p>
      <table className="mt-4 w-full table-fixed border-separate border-spacing-[2px] text-sm">
        <caption className="sr-only">
          {metricLabel} for each combination of construction cost change (rows) and end value change (columns)
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-16 px-1 py-1 text-left text-xs font-medium text-slate-500 sm:w-36 sm:px-2">
              Construction ↓ / End value →
            </th>
            {data.matrix[0]!.map((c) => (
              <th key={c.endValuePct} scope="col" className="px-2 py-1 text-center text-xs font-medium text-slate-600">
                {pct(c.endValuePct)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.matrix.map((row) => (
            <tr key={row[0]!.constructionPct}>
              <th scope="row" className="px-2 py-1 text-left text-xs font-medium text-slate-600">
                {pct(row[0]!.constructionPct)}
              </th>
              {row.map((c) => {
                const base = c.constructionPct === 0 && c.endValuePct === 0;
                return (
                  <td
                    key={c.endValuePct}
                    title={`Construction ${pct(c.constructionPct)}, end value ${pct(c.endValuePct)}: ${metricLabel.toLowerCase()} ${formatAud(c.headline)}`}
                    className={`rounded px-1 py-3 text-center text-slate-900 sm:px-3 ${base ? "outline outline-2 outline-slate-900" : ""}`}
                    style={{ backgroundColor: cellColour(c.headline, maxAbs) }}
                  >
                    <span className="block text-xs font-semibold tabular-nums sm:text-sm">{formatAud(c.headline)}</span>
                    <span className="block text-xs text-slate-700">{secondary(c)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        {data.negativeCases === 0
          ? `No negative outcome in the ${data.totalCases} cases tested.`
          : `${data.negativeCases} of ${data.totalCases} cases tested are negative.`}
      </p>
    </Card>
  );
}

type Bar = { driver: string; low: SensitivityCase; high: SensitivityCase; lowLabel: string; highLabel: string };

/** Tornado chart: how far each driver moves the headline from the base case. */
export function TornadoChart({ data }: { data: Sensitivity }) {
  const base = data.matrix[1]![1]!;
  const bars: Bar[] = [
    { driver: "Construction cost", low: data.matrix[0]![1]!, high: data.matrix[2]![1]!, lowLabel: "−15%", highLabel: "+15%" },
    { driver: "End value", low: data.matrix[1]![0]!, high: data.matrix[1]![2]!, lowLabel: "−15%", highLabel: "+15%" },
    { driver: "Interest rate", low: data.interest[0]!, high: data.interest[2]!, lowLabel: "−2 pp", highLabel: "+2 pp" },
  ];
  const deltas = bars.flatMap((b) => [b.low.headline - base.headline, b.high.headline - base.headline]);
  const maxAbs = Math.max(1, ...deltas.map(Math.abs));

  // Sized close to the card's rendered width so text stays near its nominal size.
  const width = 520;
  const labelW = 112;
  const valueLabelW = 112; // room for "+15% +$352,800" outside each bar end, with margin
  const plotW = width - labelW;
  const centre = labelW + plotW / 2;
  const half = plotW / 2 - valueLabelW;
  const rowH = 56;
  const barH = 20;
  const height = bars.length * rowH + 40;
  const x = (delta: number) => centre + (delta / maxAbs) * half;

  const segment = (delta: number, y: number, caseLabel: string, driver: string, value: number) => {
    if (Math.round(delta) === 0) return null;
    const x0 = Math.min(centre, x(delta));
    const w = Math.max(2, Math.abs(x(delta) - centre));
    const positive = delta > 0;
    const labelX = positive ? x(delta) + 6 : x(delta) - 6;
    return (
      <g>
        <title>{`${driver} ${caseLabel}: ${formatAud(value)} (${formatAudDelta(delta)} vs base)`}</title>
        {/* 4px rounded data-end, square at the baseline. */}
        <path
          d={
            positive
              ? `M${x0},${y} h${w - 4} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`
              : `M${x0 + w},${y} h${-(w - 4)} a4,4 0 0 0 -4,4 v${barH - 8} a4,4 0 0 0 4,4 h${w - 4} z`
          }
          fill={positive ? POSITIVE : NEGATIVE}
        />
        <text x={labelX} y={y + barH / 2 + 4} textAnchor={positive ? "start" : "end"} className="fill-slate-700 text-[11px] tabular-nums">
          {caseLabel} {formatAudDelta(delta)}
        </text>
      </g>
    );
  };

  return (
    <Card>
      <h2 className="font-semibold">What moves the result most</h2>
      <p className="mt-1 text-sm text-slate-600">
        Change in {data.metric === "margin" ? "margin" : "uplift minus costs"} from the base case of{" "}
        <span className="font-medium tabular-nums">{formatAud(base.headline)}</span> when each assumption moves on its own.
      </p>
      {/* Phones: the same figures as a list (the chart's text would be too small to read). */}
      <dl className="mt-4 space-y-3 text-sm sm:hidden">
        {bars.map((b) => (
          <div key={b.driver}>
            <dt className="font-medium text-slate-800">{b.driver}</dt>
            {[
              [b.lowLabel, b.low.headline - base.headline],
              [b.highLabel, b.high.headline - base.headline],
            ].map(([label, delta]) => (
              <dd key={label as string} className="flex justify-between gap-2 tabular-nums">
                <span className="text-slate-600">{label}</span>
                <span className="flex items-center gap-1.5">
                  {Math.round(delta as number) !== 0 ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: (delta as number) > 0 ? POSITIVE : NEGATIVE }}
                      aria-hidden="true"
                    />
                  ) : null}
                  {Math.round(delta as number) === 0 ? "No effect" : formatAudDelta(delta as number)}
                </span>
              </dd>
            ))}
          </div>
        ))}
      </dl>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 hidden w-full sm:block" role="img" aria-labelledby="tornado-title tornado-desc">
        <title id="tornado-title">Sensitivity tornado chart</title>
        <desc id="tornado-desc">
          {bars
            .map((b) => `${b.driver}: ${b.lowLabel} ${formatAudDelta(b.low.headline - base.headline)}, ${b.highLabel} ${formatAudDelta(b.high.headline - base.headline)}`)
            .join("; ")}
        </desc>
        <line x1={centre} x2={centre} y1={8} y2={height - 24} stroke="#94a3b8" strokeWidth={1} />
        <text x={centre} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
          Base {formatAudCompact(base.headline)}
        </text>
        {bars.map((b, i) => {
          const y = 12 + i * rowH;
          return (
            <g key={b.driver}>
              <text x={0} y={y + barH + 5} className="fill-slate-800 text-[12px] font-medium">
                {b.driver}
              </text>
              {/* Two bars per row with a 2px gap: low case above, high case below. */}
              {segment(b.low.headline - base.headline, y, b.lowLabel, b.driver, b.low.headline)}
              {segment(b.high.headline - base.headline, y + barH + 2, b.highLabel, b.driver, b.high.headline)}
              {Math.round(b.low.headline - base.headline) === 0 && Math.round(b.high.headline - base.headline) === 0 ? (
                <text x={centre + 6} y={y + barH + 4} className="fill-slate-500 text-[11px]">
                  No effect
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 hidden gap-4 text-xs text-slate-600 sm:flex" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: POSITIVE }} /> Better than base
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NEGATIVE }} /> Worse than base
        </span>
      </div>
    </Card>
  );
}

export function InterestTable({ data }: { data: Sensitivity }) {
  return (
    <Card className="overflow-x-auto p-0">
      <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Interest rate sensitivity</h2>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-2">Rate change</th>
            <th scope="col" className="px-5 py-2 text-right">Interest</th>
            <th scope="col" className="px-5 py-2 text-right">{data.metric === "margin" ? "Margin" : "Uplift minus costs"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.interest.map((c) => (
            <tr key={c.interestPp}>
              <th scope="row" className="px-5 py-2 text-left font-normal">
                {c.interestPp === 0 ? (
                  "Base rate"
                ) : (
                  <>
                    {c.interestPp > 0 ? "+" : "−"}
                    {Math.abs(c.interestPp)} <abbr title="percentage points">pp</abbr>
                  </>
                )}
              </th>
              <td className="px-5 py-2 text-right tabular-nums">{formatAud(c.result.finance.totalInterest)}</td>
              <td className={`px-5 py-2 text-right tabular-nums ${c.headline < 0 ? "text-red-700" : ""}`}>{formatAud(c.headline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
