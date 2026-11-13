import Link from "next/link";
import { Badge, Flash, Money, PageHeader, Provenance } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listGroups } from "@/lib/services/groups";

export const metadata = { title: "Group buying" };

export default async function Groups({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const groups = await listGroups(await appCtx());
  return (
    <>
      <PageHeader title="Group buying" subtitle="Combine demand with people who need the same thing. Bigger groups unlock lower prices." />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map(({ group: g, status: s }) => {
          const member = g.memberIds.includes(actor.userId);
          const pct = Math.min(100, Math.round((s.members / g.targetSize) * 100));
          return (
            <Link key={g.id} href={`/app/groups/${g.id}`} className="card block hover:border-brand-300">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{getCategory(g.categoryId).name}</Badge><Badge tone="blue">{g.region}</Badge>
                {g.isSimulated && <Provenance kind="simulated" />}
                {member && <Badge tone="green">Member</Badge>}
                {s.expired ? <Badge>Closed</Badge> : <Badge tone="amber">{s.daysLeft} days left</Badge>}
              </div>
              <p className="mt-2 font-semibold">{g.title}</p>
              <p className="text-sm text-slate-600">{g.description}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-xs text-slate-500">{s.members} of {g.targetSize} target members</p>
              <p className="mt-2 text-sm">
                {s.currentPriceCents !== undefined
                  ? <>Unlocked price <Money cents={s.currentPriceCents} recurrence={g.recurrence} className="font-semibold" /> — save <Money cents={s.currentSavingsPerMemberCents} /> each</>
                  : s.next ? <>{s.next.membersNeeded} more to unlock <Money cents={s.next.tier.priceCents} recurrence={g.recurrence} className="font-semibold" /></> : <span className="text-slate-500">Waiting for business offers</span>}
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
