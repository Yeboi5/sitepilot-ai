import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DemoDataBanner } from "@/components/demo";
import { EVIDENCE_COLUMNS, EvidenceRegister } from "@/components/evidence-register";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { MATTER_STATUS } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { EvidenceActions } from "./evidence-actions";
import { EvidenceForm } from "./evidence-form";

export const metadata: Metadata = { title: "Property" };

function sydneyToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await requireOrg("investor");
  const supabase = await createClient();

  // RLS returns nothing for properties outside the user's organisation → 404, not 403,
  // so the existence of other tenants' records is not disclosed.
  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_org_id, address, suburb, postcode, lot_dp, jurisdiction, is_demo, created_at")
    .eq("id", id)
    .eq("owner_org_id", ctx.active.organisation.id)
    .maybeSingle();
  if (!property) notFound();

  const [{ data: evidence }, { data: matters }] = await Promise.all([
    supabase.from("evidence").select(EVIDENCE_COLUMNS).eq("property_id", id).order("fetched_at", { ascending: false }),
    supabase.from("matters").select("id, status, firm:organisations!matters_professional_org_id_fkey(name)").eq("property_id", id),
  ]);

  return (
    <>
      <PageHeader
        title={property.address}
        description={
          <>
            {property.suburb} {property.postcode} · {property.jurisdiction}
            {property.lot_dp ? ` · ${property.lot_dp}` : " · Lot/DP not recorded"}
          </>
        }
      />

      {property.is_demo ? (
        <div className="mb-6">
          <DemoDataBanner />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="font-semibold">Planning checks</h2>
            <div className="mt-3">
              <Alert>
                SitePilot does not make automated zoning or development-potential claims. Planning controls are recorded
                only from official evidence you attach below, with its retrieval date and verification status.
              </Alert>
            </div>
          </Card>

          <EvidenceRegister
            rows={evidence ?? []}
            description="Official documents and records relied on for this property."
            actions={(row) => <EvidenceActions row={row} propertyId={property.id} />}
          />

          <Card>
            <h2 className="mb-4 font-semibold">Add evidence</h2>
            <EvidenceForm propertyId={property.id} today={sydneyToday()} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">Feasibility scenarios</h2>
            <p className="mt-2 text-sm text-slate-600">
              Scenario modelling, comparison and sensitivity analysis arrive in the next release.
            </p>
          </Card>
          <Card>
            <h2 className="font-semibold">Matters</h2>
            {(matters ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No conveyancer engaged for this property.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {(matters ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span>{m.firm?.name ?? "Firm"}</span>
                    <Badge tone={MATTER_STATUS[m.status].tone}>{MATTER_STATUS[m.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
