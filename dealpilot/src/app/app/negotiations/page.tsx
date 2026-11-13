import Link from "next/link";
import { Badge, Empty, Flash, LinkButton, Money, PageHeader, StateBadge, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { MODE_LABELS } from "@/lib/domain/negotiation";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listCustomerNegotiations } from "@/lib/services/negotiations";

export const metadata = { title: "Negotiations" };

export default async function Negotiations({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const list = await listCustomerNegotiations(await appCtx(), actor);
  return (
    <>
      <PageHeader title="Negotiation centre" subtitle="Every negotiation, in every category, tracked in one place." actions={<LinkButton href="/app/negotiations/new">Negotiate a bill</LinkButton>} />
      <Flash error={f.error} notice={f.notice} />
      {list.length === 0 ? <Empty title="No negotiations yet" /> : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={`/app/negotiations/${n.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:border-brand-300">
                <div className="min-w-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.counterpartyName} · {MODE_LABELS[n.mode].label} mode · updated {relTime(n.updatedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Money cents={n.baselineCents} recurrence={n.recurrence} className="text-slate-400 line-through" />
                  <Money cents={n.agreedCents ?? n.currentOfferCents} recurrence={n.recurrence} className="font-semibold" />
                  {n.simulated && <Badge tone="amber">Simulated counterparty</Badge>}
                  <StateBadge state={n.state} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
