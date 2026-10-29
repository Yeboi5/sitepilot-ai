import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DemoDataBanner } from "@/components/demo";
import { sydneyDate } from "@/lib/dates";
import { EVIDENCE_COLUMNS, EvidenceRegister } from "@/components/evidence-register";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { headline } from "@/lib/finance/feasibility";
import { MATTER_STATUS, formatAud } from "@/lib/format";
import { listScenarios } from "@/lib/scenarios";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { EvidenceActions } from "./evidence-actions";
import { EvidenceForm } from "./evidence-form";

export const metadata: Metadata = { title: "Property" };

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

  const [{ data: evidence }, { data: matters }, scenarios] = await Promise.all([
    supabase.from("evidence").select(EVIDENCE_COLUMNS).eq("property_id", id).order("fetched_at", { ascending: false }),
    supabase.from("matters").select("id, status, firm:organisations!matters_professional_org_id_fkey(name)").eq("property_id", id),
    listScenarios(supabase, id),
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
            <EvidenceForm propertyId={property.id} today={sydneyDate()} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Feasibility scenarios</h2>
              <Link href={`/investor/properties/${property.id}/scenarios/new`} className="text-sm font-medium text-brand-700 underline">
                New scenario
              </Link>
            </div>
            {scenarios.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Model a development option from your own assumptions.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {scenarios.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <Link href={`/investor/properties/${property.id}/scenarios/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <span className={`tabular-nums ${s.result && headline(s.result) < 0 ? "text-red-700" : "text-slate-600"}`}>
                      {s.result ? formatAud(headline(s.result)) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {scenarios.length >= 2 ? (
                <Link href={`/investor/properties/${property.id}/scenarios/compare`} className="text-brand-700 underline">
                  Compare scenarios
                </Link>
              ) : null}
              <Link href={`/investor/properties/${property.id}/report`} className="text-brand-700 underline">
                Feasibility &amp; due-diligence report
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-500">Margin or uplift minus costs, pre-tax.</p>
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
