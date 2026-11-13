import Link from "next/link";
import { Badge, Empty, Flash, Money, PageHeader, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listRequestsForBusiness } from "@/lib/services/marketplace";

export const metadata = { title: "Customer requests" };

export default async function BizRequests({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const list = await listRequestsForBusiness(await appCtx(), actor);
  return (
    <>
      <PageHeader title="Customer requests" subtitle="Open requests that match your service categories and regions." />
      <Flash error={f.error} notice={f.notice} />
      {list.length === 0 ? <Empty title="No matching requests right now">Add categories or regions in your profile to see more.</Empty> : (
        <ul className="space-y-2">
          {list.map(({ request: r, myOffer }) => (
            <li key={r.id}>
              <Link href={`/biz/requests/${r.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:border-brand-300">
                <div><p className="font-medium">{r.title}</p><p className="text-xs text-slate-500">{getCategory(r.categoryId).name} · {r.region} · posted {relTime(r.createdAt)}</p></div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Customer&apos;s current price</span><Money cents={r.baselineCents} recurrence={r.recurrence} className="font-semibold" />
                  {myOffer ? <Badge tone="green">Your offer: {myOffer.status}</Badge> : <Badge tone="amber">No offer yet</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
