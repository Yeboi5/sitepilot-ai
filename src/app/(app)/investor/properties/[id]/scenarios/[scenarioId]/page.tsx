import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { deleteScenario } from "@/app/(app)/investor/scenario-actions";
import { DemoDataBanner } from "@/components/demo";
import { CostTable, ResultSummary, ResultWarnings, TaxBasisNote } from "@/components/scenario/results";
import { InterestTable, SensitivityMatrix, TornadoChart } from "@/components/scenario/sensitivity-views";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { APP_TIME_ZONE } from "@/lib/dates";
import { headline } from "@/lib/finance/feasibility";
import { sensitivity } from "@/lib/finance/sensitivity";
import { formatAud } from "@/lib/format";
import { getOwnedPropertyOr404 } from "@/lib/properties";
import { getScenario } from "@/lib/scenarios";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Scenario" };

const dateTime = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: APP_TIME_ZONE });

export default async function ScenarioPage({ params }: { params: Promise<{ id: string; scenarioId: string }> }) {
  const { id, scenarioId } = await params;
  if (!z.string().uuid().safeParse(scenarioId).success) notFound();
  const ctx = await requireOrg("investor");
  const supabase = await createClient();
  const property = await getOwnedPropertyOr404(supabase, id, ctx.active.organisation.id);
  const scenario = await getScenario(supabase, property.id, scenarioId);
  if (!scenario) notFound();

  const { data: history } = await supabase
    .from("scenario_results")
    .select("id, calculated_at, formula_version, result_json")
    .eq("scenario_id", scenario.id)
    .order("calculated_at", { ascending: false })
    .limit(20);

  const base = `/investor/properties/${property.id}`;
  const sens = scenario.assumptions ? sensitivity(scenario.assumptions) : null;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={base} className="text-brand-700 underline">
          ← {property.address}, {property.suburb}
        </Link>
      </p>
      <PageHeader
        title={scenario.name}
        description="Feasibility estimate from your assumptions."
        actions={
          <>
            <ButtonLink href={`${base}/scenarios/${scenario.id}/edit`} variant="secondary">
              Edit assumptions
            </ButtonLink>
            <ButtonLink href={`${base}/scenarios/compare`} variant="secondary">
              Compare
            </ButtonLink>
          </>
        }
      />
      <div className="space-y-6">
        {property.is_demo ? <DemoDataBanner /> : null}
        {!scenario.result ? (
          <Alert tone="warning">
            The saved assumptions can&apos;t be read with the current formula. <Link href={`${base}/scenarios/${scenario.id}/edit`} className="underline">Re-enter them</Link> to recalculate.
          </Alert>
        ) : (
          <>
            {scenario.recalculated ? (
              <Alert>
                Recalculated with the current formula ({scenario.result.formulaVersion}); last saved with {scenario.savedFormulaVersion}.
              </Alert>
            ) : null}
            <ResultWarnings result={scenario.result} />
            <ResultSummary result={scenario.result} />
            <TaxBasisNote />
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <CostTable result={scenario.result} />
              {sens ? <TornadoChart data={sens} /> : null}
            </div>
            {sens ? <SensitivityMatrix data={sens} /> : null}
            {sens ? <InterestTable data={sens} /> : null}
          </>
        )}

        <Card className="p-0">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Change history</h2>
          {(history ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">No saved calculations yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(history ?? []).map((h) => {
                const saved = (h.result_json as { result?: Parameters<typeof headline>[0] } | null)?.result;
                return (
                  <li key={h.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                    <span>{dateTime.format(new Date(h.calculated_at))}</span>
                    <span className="text-slate-600">
                      {saved ? `${saved.sale ? "Margin" : "Uplift minus costs"} ${formatAud(headline(saved))}` : "—"} · {h.formula_version}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <details className="text-sm">
          <summary className="cursor-pointer text-red-700 underline">Delete this scenario</summary>
          <form action={deleteScenario} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="scenarioId" value={scenario.id} />
            <span className="text-slate-700">This also removes its change history and can&apos;t be undone.</span>
            <button type="submit" className="rounded-lg bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800">
              Delete permanently
            </button>
          </form>
        </details>
      </div>
    </>
  );
}
