import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { setEvidenceStatus } from "../../actions";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { EVIDENCE_STATUS, MATTER_STATUS, formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { EVIDENCE_SOURCE_LABELS } from "@/lib/validation";
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
    .select("id, owner_org_id, address, suburb, postcode, lot_dp, jurisdiction, created_at")
    .eq("id", id)
    .eq("owner_org_id", ctx.active.organisation.id)
    .maybeSingle();
  if (!property) notFound();

  const [{ data: evidence }, { data: matters }] = await Promise.all([
    supabase
      .from("evidence")
      .select("id, title, source_type, source_url, fetched_at, verification_status, verified_at, notes, verifier:users!evidence_verified_by_fkey(display_name)")
      .eq("property_id", id)
      .order("fetched_at", { ascending: false }),
    supabase
      .from("matters")
      .select("id, status, firm:organisations!matters_professional_org_id_fkey(name)")
      .eq("property_id", id),
  ]);

  const evidenceRows = evidence ?? [];

  return (
    <>
      <PageHeader
        title={property.address}
        description={
          <>
            {property.suburb} {property.postcode} · {property.jurisdiction}
            {property.lot_dp ? ` · ${property.lot_dp}` : ""}
          </>
        }
      />

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

          <Card className="p-0">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold">Evidence register</h2>
              <p className="text-sm text-slate-600">Official documents and records relied on for this property.</p>
            </div>
            {evidenceRows.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No evidence recorded">Attach a planning certificate or Planning Portal record to begin.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {evidenceRows.map((e) => {
                  const status = EVIDENCE_STATUS[e.verification_status];
                  return (
                    <li key={e.id} className="space-y-2 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{e.title}</p>
                          <p className="text-xs text-slate-500">
                            {EVIDENCE_SOURCE_LABELS[e.source_type]} · retrieved {formatDate(e.fetched_at)}
                          </p>
                        </div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      {e.source_url ? (
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="block break-all text-sm text-brand-700 underline"
                        >
                          {e.source_url}
                        </a>
                      ) : null}
                      {e.notes ? <p className="text-sm text-slate-700">{e.notes}</p> : null}
                      {e.verification_status === "verified" ? (
                        <p className="text-xs text-slate-500">
                          Verified by {e.verifier?.display_name ?? "a team member"} on {formatDate(e.verified_at)}
                        </p>
                      ) : null}
                      <form action={setEvidenceStatus} className="flex flex-wrap gap-2">
                        <input type="hidden" name="evidenceId" value={e.id} />
                        <input type="hidden" name="propertyId" value={property.id} />
                        {e.verification_status !== "verified" ? (
                          <button name="status" value="verified" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
                            Mark verified against source
                          </button>
                        ) : (
                          <button name="status" value="unverified" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
                            Mark unverified
                          </button>
                        )}
                        {e.verification_status !== "disputed" ? (
                          <button name="status" value="disputed" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
                            Flag as disputed
                          </button>
                        ) : null}
                        {e.verification_status !== "superseded" ? (
                          <button name="status" value="superseded" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
                            Mark superseded
                          </button>
                        ) : null}
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

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
