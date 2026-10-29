import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { MATTER_STATUS, formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Investor dashboard" };

export default async function InvestorDashboard() {
  const ctx = await requireOrg("investor");
  const orgId = ctx.active.organisation.id;
  const supabase = await createClient();

  const [properties, unverified, matters] = await Promise.all([
    supabase
      .from("properties")
      .select("id, address, suburb, postcode, updated_at")
      .eq("owner_org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("evidence")
      .select("id, properties!inner(owner_org_id)", { count: "exact", head: true })
      .eq("verification_status", "unverified")
      .eq("properties.owner_org_id", orgId),
    supabase
      .from("matters")
      .select("id, status, property:properties(address), firm:organisations!matters_professional_org_id_fkey(name)")
      .eq("investor_org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const propertyRows = properties.data ?? [];
  const matterRows = matters.data ?? [];
  const activeMatters = matterRows.filter((m) => m.status === "active" || m.status === "invited").length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${ctx.user.display_name}.`}
        actions={<ButtonLink href="/investor/properties/new">Add property</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Property workspaces" value={propertyRows.length === 5 ? "5+" : propertyRows.length} />
        <Stat label="Evidence awaiting verification" value={unverified.count ?? 0} hint="Check each item against its official source" />
        <Stat label="Open matters" value={activeMatters} hint="Invited or active with a conveyancer" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent properties</h2>
            <Link href="/investor/properties" className="text-sm text-brand-700 underline">
              View all
            </Link>
          </div>
          {propertyRows.length === 0 ? (
            <EmptyState title="No properties yet">
              <Link href="/investor/properties/new" className="text-brand-700 underline">
                Create your first property workspace
              </Link>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {propertyRows.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <Link href={`/investor/properties/${p.id}`} className="font-medium hover:underline">
                    {p.address}, {p.suburb} {p.postcode}
                  </Link>
                  <span className="text-slate-500">{formatDate(p.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Matters with professionals</h2>
          {matterRows.length === 0 ? (
            <EmptyState title="No matters yet">Inviting a conveyancer arrives in an upcoming release.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {matterRows.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{m.property?.address ?? "Property"}</span>
                    <span className="text-slate-500"> · {m.firm?.name ?? "Firm"}</span>
                  </span>
                  <Badge tone={MATTER_STATUS[m.status].tone}>{MATTER_STATUS[m.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
