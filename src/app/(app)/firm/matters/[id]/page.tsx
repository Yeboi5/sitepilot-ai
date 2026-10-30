import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DemoDataBanner } from "@/components/demo";
import { EVIDENCE_COLUMNS, EvidenceRegister } from "@/components/evidence-register";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { FINDING_STATUS, MATTER_STATUS, formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Matter" };

/**
 * Conveyancer view of a client matter. Everything shown here is filtered by RLS: firm members
 * see matter metadata, but the property, evidence, documents and findings are visible only to
 * users the client has granted access to on an *active* matter.
 */
export default async function FirmMatterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await requireOrg("professional");
  const supabase = await createClient();

  const { data: matter } = await supabase
    .from("matters")
    .select("id, status, property_id, created_at, client:organisations!matters_investor_org_id_fkey(name)")
    .eq("id", id)
    .eq("professional_org_id", ctx.active.organisation.id)
    .maybeSingle();
  if (!matter) notFound();

  const [{ data: property }, { data: evidence }, { data: documents }, { data: tasks }] = await Promise.all([
    supabase.from("properties").select("address, suburb, postcode, lot_dp, jurisdiction, is_demo").eq("id", matter.property_id).maybeSingle(),
    supabase.from("evidence").select(EVIDENCE_COLUMNS).eq("property_id", matter.property_id).order("fetched_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, file_name, classification, scan_status, created_at, findings(id, category, page_ref, status)")
      .eq("matter_id", id)
      .order("created_at"),
    supabase.from("tasks").select("id, title, due_at, status, assignee:users!tasks_assignee_id_fkey(display_name)").eq("matter_id", id).order("due_at"),
  ]);

  const status = MATTER_STATUS[matter.status];

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/firm" className="text-brand-700 underline">
          ← Matter inbox
        </Link>
      </p>
      <PageHeader
        title={property ? `${property.address}, ${property.suburb}` : "Client matter"}
        description={
          <>
            Client: {matter.client?.name ?? "—"} · received {formatDate(matter.created_at)}{" "}
            <Badge tone={status.tone}>{status.label}</Badge>
          </>
        }
      />

      {!property ? (
        <Alert tone="info">
          {matter.status === "active"
            ? "The client hasn't granted you access to this matter's files. Property details, evidence and documents are shown only to people the client has authorised."
            : "Property details, evidence and documents become visible once the matter is active and the client has granted you access."}{" "}
          Nothing on this matter has been shared with you yet.
        </Alert>
      ) : (
        <>
          {property.is_demo ? (
            <div className="mb-6">
              <DemoDataBanner />
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <EvidenceRegister
                rows={evidence ?? []}
                description="Evidence the client has recorded for this property (read-only). Statuses are the client's own; they are not professional conclusions."
              />
              <Card className="p-0">
                <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Shared documents</h2>
                {(documents ?? []).length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-600">No documents shared on this matter.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {(documents ?? []).map((d) => (
                      <li key={d.id} className="px-5 py-3 text-sm">
                        <p className="font-medium">{d.file_name}</p>
                        <p className="text-xs text-slate-500">
                          {d.classification.replace(/_/g, " ")} · scan {d.scan_status} · {formatDate(d.created_at)}
                        </p>
                        {d.findings.length > 0 ? (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {d.findings.map((f) => (
                              <li key={f.id}>
                                <Badge tone={FINDING_STATUS[f.status].tone}>
                                  {f.category.replace(/_/g, " ")} · p{f.page_ref} · {FINDING_STATUS[f.status].label}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <h2 className="font-semibold">Property</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Jurisdiction</dt>
                    <dd>{property.jurisdiction}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Postcode</dt>
                    <dd>{property.postcode ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Lot and plan</dt>
                    <dd>{property.lot_dp ?? "Not recorded"}</dd>
                  </div>
                </dl>
              </Card>
              <Card>
                <h2 className="mb-3 font-semibold">Tasks</h2>
                {(tasks ?? []).length === 0 ? (
                  <p className="text-sm text-slate-600">No tasks.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {(tasks ?? []).map((t) => (
                      <li key={t.id}>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-slate-500">
                          {t.assignee?.display_name ?? "Unassigned"} · due {formatDate(t.due_at)} · {t.status.replace("_", " ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
