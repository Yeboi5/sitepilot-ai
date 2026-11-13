import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, cx, DemoNote, Flash, Money, PageHeader, Provenance, TxBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { tierFor } from "@/lib/domain/groups";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { getGroup } from "@/lib/services/groups";
import { growGroupAction, joinGroupAction, leaveGroupAction, takeUpGroupAction } from "../../../actions/customer";

export const metadata = { title: "Buying group" };

export default async function GroupPage({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const data = await getGroup(await appCtx(), actor, id).catch(() => null);
  if (!data) notFound();
  const { group: g, status: s, isMember, eligibility, businesses, takenUp } = data;
  return (
    <>
      <PageHeader title={g.title} subtitle={<span className="flex flex-wrap items-center gap-2">{getCategory(g.categoryId).name} · {g.region} {g.isSimulated && <Provenance kind="simulated">Simulated group</Provenance>}</span>} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <p className="text-sm text-slate-700">{g.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-slate-500">Members</dt><dd className="font-semibold">{s.members} / {g.targetSize}</dd></div>
              <div><dt className="text-xs text-slate-500">Typical price now</dt><dd className="font-semibold"><Money cents={g.baselineCents} recurrence={g.recurrence} /></dd></div>
              <div><dt className="text-xs text-slate-500">Group price</dt><dd className="font-semibold">{s.currentPriceCents !== undefined ? <Money cents={s.currentPriceCents} recurrence={g.recurrence} /> : "Not unlocked"}</dd></div>
              <div><dt className="text-xs text-slate-500">Closes</dt><dd className="font-semibold">{s.expired ? "Closed" : `in ${s.daysLeft} days`}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Eligibility: {g.eligibility}. {g.simulatedMemberCount > 0 && <>Includes {g.simulatedMemberCount} simulated placeholder members.</>} Member identities are never shared.</p>
          </Card>
          <Card title="Business volume offers">
            {g.offers.length === 0 ? <p className="text-sm text-slate-600">No offers yet. Registered businesses in this category have been invited.</p> : g.offers.map((o) => {
              const active = tierFor(o.tiers, s.members);
              return (
                <div key={o.id} className="mb-3 rounded-xl border border-slate-200 p-3 last:mb-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{businesses.get(o.businessId)?.name}</p>{o.isSimulated ? <Provenance kind="simulated" /> : <Provenance kind="live">Registered business</Provenance>}<span className="text-xs text-slate-500">valid until {new Date(o.validUntil).toLocaleDateString("en-AU")}</span></div>
                  <p className="mt-1 text-sm text-slate-600">{o.terms}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.tiers.map((t) => (
                      <div key={t.minMembers} className={cx("rounded-lg px-3 py-2 text-sm ring-1", active === t ? "bg-brand-50 ring-brand-300" : s.members >= t.minMembers ? "ring-slate-200" : "bg-slate-50 ring-slate-200")}>
                        <p className="text-xs text-slate-500">{t.minMembers}+ members</p>
                        <p className="font-semibold"><Money cents={t.priceCents} recurrence={g.recurrence} /></p>
                        <p className="text-xs text-brand-700">save <Money cents={g.baselineCents - t.priceCents} /></p>
                        {active === t && <Badge tone="green">Unlocked</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Your membership">
            {takenUp ? (
              <div className="space-y-2 text-sm"><p className="flex items-center gap-2">You took up this deal <TxBadge status={takenUp.status} /></p><Link className="text-brand-700 underline" href="/app/savings">Verify in Savings →</Link></div>
            ) : isMember ? (
              <div className="space-y-3">
                <Badge tone="green">You&apos;re a member</Badge>
                {s.currentPriceCents !== undefined && (
                  <form action={takeUpGroupAction} className="space-y-2">
                    <input type="hidden" name="id" value={g.id} />
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" required className="mt-1" /> Take up the group price of <Money cents={s.currentPriceCents} recurrence={g.recurrence} /></label>
                    <button className="btn-primary w-full" type="submit">Take up deal</button>
                  </form>
                )}
                <form action={leaveGroupAction}><input type="hidden" name="id" value={g.id} /><button className="btn-secondary w-full" type="submit">Leave group</button></form>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">{eligibility.reason}.</p>
                {s.next && <p className="text-sm">Joining brings the group to {s.members + 1} members{s.next.membersNeeded === 1 && <> and <strong>unlocks <Money cents={s.next.tier.priceCents} /></strong></>}.</p>}
                <form action={joinGroupAction}><input type="hidden" name="id" value={g.id} /><button className="btn-primary w-full" type="submit" disabled={!eligibility.eligible}>Join group (free)</button></form>
              </div>
            )}
          </Card>
          {g.isSimulated && !s.expired && (
            <Card title="Demo controls">
              <form action={growGroupAction} className="space-y-2">
                <input type="hidden" name="id" value={g.id} /><input type="hidden" name="count" value="5" />
                <DemoNote>Adds 5 simulated placeholder members so you can see higher tiers unlock.</DemoNote>
                <button className="btn-secondary w-full" type="submit">Simulate 5 neighbours joining</button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
