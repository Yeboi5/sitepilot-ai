import Link from "next/link";
import { Card, Flash, LinkButton, Money, PageHeader, Stat, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { flash, type SearchParams } from "@/lib/page";
import { businessDashboard } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { listAlerts } from "@/lib/services/monitoring";

export const metadata = { title: "Business dashboard" };

export default async function BizDashboard({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const ctx = await appCtx();
  const [d, alerts] = await Promise.all([businessDashboard(ctx, actor), listAlerts(ctx, actor)]);
  return (
    <>
      <PageHeader title={d.business.name} subtitle="Customer acquisition dashboard" actions={<LinkButton href="/biz/requests">See customer requests</LinkButton>} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Matching open requests" value={d.matchingRequests} />
        <Stat label="Awaiting your reply" value={d.awaitingReply} hint={d.awaitingReply ? <Link className="text-brand-700 underline" href="/biz/inbox">Open inbox</Link> : undefined} />
        <Stat label="Offers submitted / won" value={`${d.offersSubmitted} / ${d.offersWon}`} hint={`${d.winRate}% win rate`} />
        <Stat tone="brand" label="Work won" value={<Money cents={d.wonValueCents} />} hint={`${d.customersAcquired} verified customer${d.customersAcquired === 1 ? "" : "s"}`} />
      </div>
      <Card title="Notifications" className="mt-6">
        {alerts.length === 0 ? <p className="text-sm text-slate-600">No notifications yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {alerts.slice(0, 15).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{a.href ? <Link className="font-medium hover:underline" href={a.href}>{a.title}</Link> : a.title} <span className="text-slate-500">{a.body}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{relTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-xs text-slate-500">DealPilot never shows you a customer&apos;s identity, target price or competing bid prices. Offers you submit must be approved by a person at your business.</p>
    </>
  );
}
