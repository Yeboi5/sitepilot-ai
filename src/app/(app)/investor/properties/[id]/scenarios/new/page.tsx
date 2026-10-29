import type { Metadata } from "next";
import Link from "next/link";
import { ScenarioForm } from "@/components/scenario/scenario-form";
import { PageHeader } from "@/components/ui";
import { EMPTY_ASSUMPTIONS } from "@/lib/finance/assumptions";
import { getOwnedPropertyOr404 } from "@/lib/properties";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New scenario" };

export default async function NewScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg("investor");
  const supabase = await createClient();
  const property = await getOwnedPropertyOr404(supabase, id, ctx.active.organisation.id);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/investor/properties/${property.id}`} className="text-brand-700 underline">
          ← {property.address}
        </Link>
      </p>
      <PageHeader title="New scenario" description="Model one development option. You can compare scenarios once you have two or more." />
      <ScenarioForm propertyId={property.id} scenarioId={null} name="" assumptions={EMPTY_ASSUMPTIONS} />
    </>
  );
}
