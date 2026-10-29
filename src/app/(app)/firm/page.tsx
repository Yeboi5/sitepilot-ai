import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { MATTER_STATUS, formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Matter inbox" };

export default async function FirmDashboard() {
  const ctx = await requireOrg("professional");
  const org = ctx.active.organisation;
  const supabase = await createClient();

  const [{ data: matters }, { count: queueCount }, { data: tasks }] = await Promise.all([
    supabase
      .from("matters")
      .select("id, status, created_at, property:properties(address, suburb), client:organisations!matters_investor_org_id_fkey(name)")
      .eq("professional_org_id", org.id)
      .order("created_at", { ascending: false }),
    supabase.from("findings").select("id", { count: "exact", head: true }).in("status", ["unreviewed", "needs_clarification"]),
    supabase
      .from("tasks")
      .select("id, title, due_at, status")
      .eq("assignee_id", ctx.user.id)
      .in("status", ["open", "in_progress"])
      .order("due_at", { ascending: true })
      .limit(5),
  ]);

  const rows = matters ?? [];
  const invited = rows.filter((m) => m.status === "invited");
  const active = rows.filter((m) => m.status === "active");

  return (
    <>
      <PageHeader title="Matter inbox" description={org.name} />
      {org.verification_status !== "verified" ? (
        <div className="mb-6">
          <Alert tone="warning">
            Your firm&apos;s professional credentials are being verified manually as part of the pilot. Clients can&apos;t share
            documents with your firm until verification is complete.
          </Alert>
        </div>
      ) : null}
      {ctx.aal !== "aal2" ? (
        <div className="mb-6">
          <Alert tone="info">Multi-factor authentication will be required for professionals before client files can be opened.</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="New invitations" value={invited.length} />
        <Stat label="Active matters" value={active.length} />
        <Link href="/firm/review" className="block">
          <Stat label="Findings to review" value={queueCount ?? 0} hint="AI flags on matters you can access" />
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-2">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Matters</h2>
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No matters yet">Client invitations will appear here.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {m.property ? `${m.property.address}, ${m.property.suburb}` : "Property details shared after acceptance and grant"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Client: {m.client?.name ?? "—"} · received {formatDate(m.created_at)}
                    </p>
                  </div>
                  <Badge tone={MATTER_STATUS[m.status].tone}>{MATTER_STATUS[m.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
          {invited.length > 0 ? (
            <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              Accepting invitations (with conflict and engagement checklist) is coming in the next release.
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">My open tasks</h2>
          {(tasks ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">Nothing assigned to you.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(tasks ?? []).map((t) => (
                <li key={t.id}>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-slate-500">Due {formatDate(t.due_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
