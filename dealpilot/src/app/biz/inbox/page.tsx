import Link from "next/link";
import { Empty, Flash, Money, PageHeader, StateBadge, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listBusinessInbox } from "@/lib/services/negotiations";

export const metadata = { title: "Negotiation inbox" };

export default async function Inbox({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const list = await listBusinessInbox(await appCtx(), actor);
  return (
    <>
      <PageHeader title="Negotiation inbox" subtitle="Counteroffer requests from customers on your offers." />
      <Flash error={f.error} notice={f.notice} />
      {list.length === 0 ? <Empty title="No negotiations yet" /> : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={`/biz/inbox/${n.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:border-brand-300">
                <div><p className="font-medium">{n.title}</p><p className="text-xs text-slate-500">Updated {relTime(n.updatedAt)}</p></div>
                <div className="flex items-center gap-2 text-sm">Your offer <Money cents={n.agreedCents ?? n.currentOfferCents} recurrence={n.recurrence} className="font-semibold" /><StateBadge state={n.state} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
