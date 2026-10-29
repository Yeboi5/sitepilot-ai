import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ScenarioForm } from "@/components/scenario/scenario-form";
import { Alert, PageHeader } from "@/components/ui";
import { EMPTY_ASSUMPTIONS } from "@/lib/finance/assumptions";
import { getOwnedPropertyOr404 } from "@/lib/properties";
import { getScenario } from "@/lib/scenarios";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit scenario" };

export default async function EditScenarioPage({ params }: { params: Promise<{ id: string; scenarioId: string }> }) {
  const { id, scenarioId } = await params;
  if (!z.string().uuid().safeParse(scenarioId).success) notFound();
  const ctx = await requireOrg("investor");
  const supabase = await createClient();
  const property = await getOwnedPropertyOr404(supabase, id, ctx.active.organisation.id);
  const scenario = await getScenario(supabase, property.id, scenarioId);
  if (!scenario) notFound();

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/investor/properties/${property.id}/scenarios/${scenario.id}`} className="text-brand-700 underline">
          ← {scenario.name}
        </Link>
      </p>
      <PageHeader title="Edit scenario" description={property.address} />
      {!scenario.assumptions ? (
        <div className="mb-6">
          <Alert tone="warning">This scenario&apos;s saved assumptions are in an older format. Re-enter them below to recalculate.</Alert>
        </div>
      ) : null}
      <ScenarioForm propertyId={property.id} scenarioId={scenario.id} name={scenario.name} assumptions={scenario.assumptions ?? EMPTY_ASSUMPTIONS} />
    </>
  );
}
