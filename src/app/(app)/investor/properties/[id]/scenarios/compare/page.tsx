import type { Metadata } from "next";
import Link from "next/link";
import { TaxBasisNote } from "@/components/scenario/results";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { STRATEGY_LABELS } from "@/lib/finance/assumptions";
import type { FeasibilityResult } from "@/lib/finance/feasibility";
import { sensitivity } from "@/lib/finance/sensitivity";
import { formatAud, formatRatio } from "@/lib/format";
import { getOwnedPropertyOr404 } from "@/lib/properties";
import { listScenarios, type LoadedScenario } from "@/lib/scenarios";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Compare scenarios" };

type Row = { label: string; value: (r: FeasibilityResult, s: LoadedScenario) => string; negative?: (r: FeasibilityResult) => boolean };

const ROWS: Row[] = [
  { label: "Strategy", value: (r) => STRATEGY_LABELS[r.strategy] },
  { label: "Total development cost", value: (r) => formatAud(r.totalDevelopmentCost) },
  { label: "Land", value: (r) => formatAud(r.costs.land) },
  { label: "Construction", value: (r) => formatAud(r.costs.hard) },
  { label: "Contingency", value: (r) => formatAud(r.costs.contingency) },
  { label: "Interest", value: (r) => formatAud(r.costs.interest) },
  { label: "Equity required", value: (r) => formatAud(r.finance.equityRequired) },
  { label: "Peak debt", value: (r) => formatAud(r.finance.peakDebt) },
  { label: "Assumed sale value", value: (r) => (r.sale ? formatAud(r.sale.realisation) : "—") },
  { label: "Margin", value: (r) => (r.sale ? formatAud(r.sale.margin) : "—"), negative: (r) => (r.sale?.margin ?? 0) < 0 },
  { label: "Return on cost (ROI)", value: (r) => (r.sale ? formatRatio(r.sale.roi) : "—"), negative: (r) => (r.sale?.roi ?? 0) < 0 },
  { label: "Yield on incremental cost", value: (r) => (r.rent ? formatRatio(r.rent.yieldOnIncrementalCost) : "—") },
  { label: "Cash flow after interest (per year)", value: (r) => (r.rent ? formatAud(r.rent.cashFlowAfterInterestAnnual) : "—"), negative: (r) => (r.rent?.cashFlowAfterInterestAnnual ?? 0) < 0 },
  { label: "Uplift minus costs", value: (r) => (r.rent ? formatAud(r.rent.upliftMinusCosts) : "—"), negative: (r) => (r.rent?.upliftMinusCosts ?? 0) < 0 },
  {
    label: "Negative outcomes in sensitivity test",
    value: (_r, s) => {
      const sens = sensitivity(s.assumptions!);
      return `${sens.negativeCases} of ${sens.totalCases}`;
    },
  },
];

export default async function CompareScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg("investor");
  const supabase = await createClient();
  const property = await getOwnedPropertyOr404(supabase, id, ctx.active.organisation.id);
  const scenarios = (await listScenarios(supabase, property.id)).filter((s) => s.result);
  const base = `/investor/properties/${property.id}`;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={base} className="text-brand-700 underline">
          ← {property.address}, {property.suburb}
        </Link>
      </p>
      <PageHeader title="Compare scenarios" description="Side by side, recalculated from each scenario's current assumptions." />
      {scenarios.length < 2 ? (
        <EmptyState title="Add at least two scenarios to compare">
          <Link href={`${base}/scenarios/new`} className="text-brand-700 underline">
            Create a scenario
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {scenarios.some((s) => s.result!.warnings.length > 0) ? (
            <Alert tone="danger">
              {scenarios.filter((s) => s.result!.warnings.length > 0).map((s) => s.name).join(", ")}{" "}
              {scenarios.filter((s) => s.result!.warnings.length > 0).length === 1 ? "has" : "have"} warnings: open the
              scenario for details.
            </Alert>
          ) : null}
          <Card className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Scenario comparison</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-left">
                <tr>
                  <th scope="col" className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Measure
                  </th>
                  {scenarios.map((s) => (
                    <th key={s.id} scope="col" className="px-5 py-3 text-right">
                      <Link href={`${base}/scenarios/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                        {s.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="px-5 py-2 text-left font-normal text-slate-700">
                      {row.label}
                    </th>
                    {scenarios.map((s) => (
                      <td key={s.id} className={`px-5 py-2 text-right tabular-nums ${row.negative?.(s.result!) ? "text-red-700" : ""}`}>
                        {row.value(s.result!, s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <TaxBasisNote />
        </div>
      )}
    </>
  );
}
