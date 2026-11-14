import { Bell, FileText, Gavel, LineChart, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Empty, Flash, LinkButton, Money, PageHeader, Stat, StateBadge, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { MODE_LABELS } from "@/lib/domain/negotiation";
import { flash, type SearchParams } from "@/lib/page";
import { customerDashboard } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { markAlertReadAction } from "../actions/customer";

export const metadata = { title: "Dashboard" };

const QUICK = [
  { href: "/app/documents", label: "Upload a bill or quote", icon: FileText },
  { href: "/app/requests/new", label: "Get businesses bidding", icon: Gavel },
  { href: "/app/groups", label: "Join a buying group", icon: Users },
  { href: "/app/monitor", label: "Track a price", icon: LineChart },
  { href: "/app/guardian", label: "Money Guardian", icon: ShieldCheck },
  { href: "/app/settings", label: "AI permissions", icon: SlidersHorizontal },
];

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { user, actor } = await requireUser("customer");
  const d = await customerDashboard(await appCtx(), actor);
  return (
    <>
      <PageHeader title={`Hi ${user.name.split(" ")[0]}`} subtitle={<>AI mode: <strong>{MODE_LABELS[user.permissionMode].label}</strong> · <Link className="text-brand-700 underline" href="/app/settings">change</Link></>} actions={<LinkButton href="/app/documents">Upload a bill or quote</LinkButton>} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="brand" label="Realised savings" value={<Money cents={d.summary.realisedCents} />} hint={`Verified · ${d.summary.verifiedCount} deal${d.summary.verifiedCount === 1 ? "" : "s"}`} />
        <Stat label="Recurring saving / month" value={<Money cents={d.summary.monthlyRecurringCents} />} hint="From verified bill reductions" />
        <Stat label="Projected next 12 months" value={<Money cents={d.summary.projectedAnnualCents} />} hint="Projection — not yet realised" />
        <Stat label="Pending verification" value={<Money cents={d.summary.pendingCents} />} hint="Not counted until you confirm the invoice" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Needs your attention">
            {d.needsAction.length === 0 && d.pendingTransactions.length === 0 ? (
              <p className="text-sm text-slate-600">Nothing waiting on you.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.needsAction.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/app/negotiations/${n.id}`} className="min-w-0 truncate text-sm font-medium text-brand-800 hover:underline">{n.title}</Link>
                    <StateBadge state={n.state} />
                  </li>
                ))}
                {d.pendingTransactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href="/app/savings" className="min-w-0 truncate text-sm font-medium text-brand-800 hover:underline">Verify: {t.description}</Link>
                    <Badge tone="amber">Confirm invoice</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Active negotiations" action={<Link href="/app/negotiations" className="text-sm text-brand-700">All →</Link>}>
            {d.activeNegotiations.length === 0 ? <Empty title="No active negotiations" action={<LinkButton href="/app/negotiations/new">Negotiate a bill</LinkButton>} /> : (
              <ul className="divide-y divide-slate-100">
                {d.activeNegotiations.slice(0, 6).map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/app/negotiations/${n.id}`} className="font-medium hover:underline">{n.title}</Link>
                    <span className="flex items-center gap-2"><Money cents={n.currentOfferCents} recurrence={n.recurrence} />{n.simulated && <Badge tone="amber">Simulated</Badge>}<StateBadge state={n.state} /></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Open requests" action={<Link href="/app/requests" className="text-sm text-brand-700">All →</Link>}>
            {d.openRequests.length === 0 ? <p className="text-sm text-slate-600">No open requests.</p> : (
              <ul className="divide-y divide-slate-100">
                {d.openRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/app/requests/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <Badge tone="blue">{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Alerts</span>}>
            {d.unreadAlerts.length === 0 ? <p className="text-sm text-slate-600">You&apos;re all caught up.</p> : (
              <ul className="space-y-3">
                {d.unreadAlerts.slice(0, 8).map((a) => (
                  <li key={a.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-medium">{a.href ? <Link href={a.href} className="hover:underline">{a.title}</Link> : a.title}</p>
                    <p className="mt-0.5 text-slate-600">{a.body}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{relTime(a.createdAt)}</span>
                      <form action={markAlertReadAction}><input type="hidden" name="id" value={a.id} /><button className="underline">Dismiss</button></form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <Link key={q.href} href={q.href} className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm hover:border-brand-300 hover:bg-brand-50">
                  <q.icon className="h-5 w-5 text-brand-600" aria-hidden />{q.label}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">{d.watchCount} items monitored · {d.groupCount} buying group{d.groupCount === 1 ? "" : "s"} · <Link className="underline" href="/journeys">demo journeys</Link></p>
          </Card>
        </div>
      </div>
    </>
  );
}
