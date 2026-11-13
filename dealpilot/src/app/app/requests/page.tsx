import Link from "next/link";
import { Badge, Empty, Flash, LinkButton, Money, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listCustomerRequests } from "@/lib/services/marketplace";

export const metadata = { title: "Requests & bids" };

export default async function Requests({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const ctx = await appCtx();
  const reqs = await listCustomerRequests(ctx, actor);
  const offers = await ctx.store.list("offers");
  return (
    <>
      <PageHeader title="Requests & bids" subtitle="Tell businesses what you need. They compete for it." actions={<LinkButton href="/app/requests/new">New request</LinkButton>} />
      <Flash error={f.error} notice={f.notice} />
      {reqs.length === 0 ? <Empty title="No requests yet" action={<LinkButton href="/app/requests/new">Create a request</LinkButton>} /> : (
        <ul className="space-y-2">
          {reqs.map((r) => {
            const n = offers.filter((o) => o.requestId === r.id && o.status !== "draft" && o.status !== "withdrawn").length;
            return (
              <li key={r.id}>
                <Link href={`/app/requests/${r.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:border-brand-300">
                  <div className="min-w-0">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-slate-500">{getCategory(r.categoryId).name} · {r.region}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Your price</span> <Money cents={r.baselineCents} recurrence={r.recurrence} className="font-semibold" />
                    <Badge tone="blue">{n} offer{n === 1 ? "" : "s"}</Badge>
                    <Badge tone={r.status === "completed" ? "green" : r.status === "cancelled" ? "slate" : "amber"}>{r.status}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
