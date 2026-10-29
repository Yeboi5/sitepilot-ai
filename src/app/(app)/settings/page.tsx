import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { APP_TIME_ZONE } from "@/lib/dates";
import { ORG_VERIFICATION, PLAN_LABEL, formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Organisation settings" };

const dateTime = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: APP_TIME_ZONE });

export default async function SettingsPage() {
  const ctx = await requireOrg();
  const org = ctx.active.organisation;
  const isAdmin = ctx.active.role === "admin";
  const supabase = await createClient();

  const [{ data: members }, { data: subscription }, audit] = await Promise.all([
    supabase.from("memberships").select("role, created_at, user:users(id, display_name)").eq("organisation_id", org.id).order("created_at"),
    supabase.from("subscriptions").select("plan, status, current_period_end").eq("organisation_id", org.id).maybeSingle(),
    isAdmin
      ? supabase
          .from("audit_events")
          .select("id, action, resource_type, resource_id, timestamp, actor_id")
          .eq("organisation_id", org.id)
          .order("timestamp", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
  ]);

  const names = new Map((members ?? []).map((m) => [m.user?.id, m.user?.display_name]));

  return (
    <>
      <PageHeader title="Organisation settings" description={org.name} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="font-semibold">Organisation</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Type</dt>
              <dd>{org.type === "investor" ? "Investor / developer" : "Professional firm"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Verification</dt>
              <dd>
                <Badge tone={ORG_VERIFICATION[org.verification_status].tone}>{ORG_VERIFICATION[org.verification_status].label}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Your role</dt>
              <dd className="capitalize">{ctx.active.role}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="font-semibold">Billing</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Plan</dt>
              <dd>{subscription ? PLAN_LABEL[subscription.plan] : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Status</dt>
              <dd className="capitalize">{subscription?.status.replace("_", " ") ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Billing is not live during the pilot. No payment details are collected.</p>
        </Card>

        <Card>
          <h2 className="font-semibold">Members</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(members ?? []).map((m) => (
              <li key={m.user?.id} className="flex justify-between gap-2">
                <span>{m.user?.display_name}</span>
                <span className="capitalize text-slate-500">{m.role}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {isAdmin ? (
        <Card className="mt-6 overflow-x-auto p-0">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Audit log</h2>
          {(audit.data ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">No events yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2">When</th>
                  <th scope="col" className="px-5 py-2">Who</th>
                  <th scope="col" className="px-5 py-2">Action</th>
                  <th scope="col" className="px-5 py-2">Resource</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(audit.data ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-5 py-2 text-slate-600">{dateTime.format(new Date(e.timestamp))}</td>
                    <td className="px-5 py-2">{(e.actor_id && names.get(e.actor_id)) ?? (e.actor_id ? "External user" : "System")}</td>
                    <td className="px-5 py-2 capitalize">{e.action}</td>
                    <td className="px-5 py-2 font-mono text-xs text-slate-600">
                      {e.resource_type}
                      {e.resource_id ? `:${e.resource_id.slice(0, 8)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <p className="mt-6 text-xs text-slate-500">The audit log is visible to organisation administrators. Member since {formatDate(members?.find((m) => m.user?.id === ctx.user.id)?.created_at)}.</p>
      )}
    </>
  );
}
