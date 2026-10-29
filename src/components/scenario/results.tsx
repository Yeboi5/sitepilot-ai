import { Alert, Card, Stat } from "@/components/ui";
import { STRATEGY_LABELS } from "@/lib/finance/assumptions";
import type { CostBreakdown, FeasibilityResult } from "@/lib/finance/feasibility";
import { formatAud, formatRatio } from "@/lib/format";

export const COST_LABELS: Record<keyof CostBreakdown, string> = {
  land: "Land (price or opportunity cost)",
  acquisition: "Acquisition (stamp duty estimate, legal)",
  soft: "Design and approvals",
  hard: "Construction (demolition, site works, build, infrastructure)",
  contingency: "Contingency",
  holding: "Holding costs",
  financeFees: "Finance fees",
  interest: "Interest (capitalised)",
  selling: "Selling costs",
};

export function headlineStats(r: FeasibilityResult) {
  if (r.sale) {
    return [
      { label: "Margin", value: formatAud(r.sale.margin), negative: r.sale.margin < 0 },
      { label: "Return on cost (ROI)", value: formatRatio(r.sale.roi), negative: (r.sale.roi ?? 0) < 0 },
      { label: "Total development cost", value: formatAud(r.totalDevelopmentCost), negative: false },
      { label: "Assumed sale value", value: formatAud(r.sale.realisation), negative: false },
    ];
  }
  const rent = r.rent!;
  return [
    { label: "Uplift minus costs", value: formatAud(rent.upliftMinusCosts), negative: rent.upliftMinusCosts < 0 },
    { label: "Yield on incremental cost", value: formatRatio(rent.yieldOnIncrementalCost), negative: (rent.yieldOnIncrementalCost ?? 0) < 0 },
    { label: "Cash flow after interest", value: `${formatAud(rent.cashFlowAfterInterestAnnual)} / yr`, negative: rent.cashFlowAfterInterestAnnual < 0 },
    { label: "Incremental project cost", value: formatAud(rent.incrementalCost), negative: false },
  ];
}

export function TaxBasisNote() {
  return (
    <p className="text-xs text-slate-500">
      Pre-tax. GST, capital gains tax and income tax are not modelled, and nothing here is a tax determination. Every
      input is your assumption.
    </p>
  );
}

export function ResultWarnings({ result }: { result: FeasibilityResult }) {
  if (result.warnings.length === 0) return null;
  return (
    <Alert tone="danger">
      <p className="font-medium">Warning</p>
      <ul className="mt-1 list-disc pl-5">
        {result.warnings.map((w) => (
          <li key={w.code}>{w.message}</li>
        ))}
      </ul>
    </Alert>
  );
}

export function ResultSummary({ result }: { result: FeasibilityResult }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {headlineStats(result).map((s) => (
          <Stat key={s.label} label={s.label} value={<span className={s.negative ? "text-red-700" : undefined}>{s.value}</span>} />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Strategy: {STRATEGY_LABELS[result.strategy]} · formula {result.formulaVersion}
      </p>
    </div>
  );
}

export function CostTable({ result }: { result: FeasibilityResult }) {
  const rows = (Object.keys(COST_LABELS) as (keyof CostBreakdown)[]).filter((k) => !(k === "selling" && !result.sale));
  return (
    <Card className="overflow-x-auto p-0">
      <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Total development cost</h2>
      <table className="min-w-full text-sm">
        <caption className="sr-only">Cost breakdown</caption>
        <tbody className="divide-y divide-slate-100">
          {rows.map((k) => (
            <tr key={k}>
              <th scope="row" className="px-5 py-2 text-left font-normal text-slate-700">{COST_LABELS[k]}</th>
              <td className="px-5 py-2 text-right tabular-nums">{formatAud(result.costs[k])}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <th scope="row" className="px-5 py-2 text-left">Total</th>
            <td className="px-5 py-2 text-right tabular-nums">{formatAud(result.totalDevelopmentCost)}</td>
          </tr>
        </tbody>
      </table>
      <dl className="grid gap-x-6 gap-y-1 border-t border-slate-200 px-5 py-4 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-600">Debt drawn</dt>
          <dd className="tabular-nums">{formatAud(result.finance.principalDrawn)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-600">Peak debt (with interest)</dt>
          <dd className="tabular-nums">{formatAud(result.finance.peakDebt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-600">Equity required</dt>
          <dd className="tabular-nums">{formatAud(result.finance.equityRequired)}</dd>
        </div>
        {result.rent ? (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Incremental net rent</dt>
              <dd className="tabular-nums">{formatAud(result.rent.incrementalNetRentAnnual)} / yr</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Interest at completion</dt>
              <dd className="tabular-nums">{formatAud(result.rent.annualInterestAtCompletion)} / yr</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Valuation uplift</dt>
              <dd className="tabular-nums">{formatAud(result.rent.valuationUplift)}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </Card>
  );
}
