import type { Metadata } from "next";
import Link from "next/link";
import { DemoBadge } from "@/components/demo";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const ctx = await requireOrg("investor");
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, address, suburb, postcode, lot_dp, jurisdiction, is_demo, created_at, evidence(count)")
    .eq("owner_org_id", ctx.active.organisation.id)
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Properties"
        description="Each property is a private workspace for your organisation."
        actions={<ButtonLink href="/investor/properties/new">Add property</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No properties yet">Add an address to start a workspace.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Address</th>
                <th scope="col" className="px-4 py-3">Lot / DP</th>
                <th scope="col" className="px-4 py-3">Jurisdiction</th>
                <th scope="col" className="px-4 py-3">Evidence</th>
                <th scope="col" className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/investor/properties/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.address}, {p.suburb} {p.postcode}
                    </Link>
                    {p.is_demo ? (
                      <span className="ml-2">
                        <DemoBadge />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.lot_dp ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.jurisdiction}</td>
                  <td className="px-4 py-3 text-slate-600">{p.evidence[0]?.count ?? 0}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
