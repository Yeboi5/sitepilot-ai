import Link from "next/link";
import { DemoBadge } from "@/components/demo";
import { Badge, ButtonLink, Card, EmptyState, Stat } from "@/components/ui";
import { MATTER_STATUS, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Signed-in investor summary (previously the /investor dashboard). All reads go through RLS. */
export async function YourProjects({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const [properties, unverified, matters] = await Promise.all([
    supabase
      .from("properties")
      .select("id, address, suburb, postcode, is_demo, updated_at")
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
  const openMatters = matterRows.filter((m) => m.status === "active" || m.status === "invited").length;

  return (
    <section aria-labelledby="your-projects" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="your-projects" className="text-xl font-extrabold">
          Your projects
        </h2>
        <ButtonLink href="/analyse" variant="secondary">
          Add a property
        </ButtonLink>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Property workspaces" value={propertyRows.length === 5 ? "5+" : propertyRows.length} />
        <Stat label="Evidence to verify" value={unverified.count ?? 0} hint="Check each item against its official source" />
        <Stat label="Open matters" value={openMatters} hint="With a conveyancer" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Recent properties</h3>
            <Link href="/investor/properties" className="text-sm font-medium text-brand-700 underline">
              View all
            </Link>
          </div>
          {propertyRows.length === 0 ? (
            <EmptyState title="No properties yet">
              <Link href="/analyse" className="text-brand-700 underline">
                Start with an address
              </Link>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-sand-100">
              {propertyRows.map((p) => (
                <li key={p.id} className="flex min-h-11 items-center justify-between gap-2 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/investor/properties/${p.id}`} className="font-medium hover:underline">
                      {p.address}, {p.suburb} {p.postcode}
                    </Link>
                    {p.is_demo ? <DemoBadge /> : null}
                  </span>
                  <span className="shrink-0 text-slate-500">{formatDate(p.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Matters with professionals</h3>
          {matterRows.length === 0 ? (
            <p className="text-sm text-slate-600">No conveyancer engaged yet.</p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {matterRows.map((m) => (
                <li key={m.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
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
    </section>
  );
}
