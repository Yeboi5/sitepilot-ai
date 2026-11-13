import { Empty, Money, PageHeader, TxBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { appCtx } from "@/lib/services/app-context";
import { listBusinessTransactions } from "@/lib/services/transactions";

export const metadata = { title: "Transactions" };

export default async function BizTransactions() {
  const { actor } = await requireUser("business");
  const txs = await listBusinessTransactions(await appCtx(), actor);
  return (
    <>
      <PageHeader title="Transaction history" subtitle="Jobs won through DealPilot. Businesses pay no fees in this prototype; provider commissions are a future option." />
      {txs.length === 0 ? <Empty title="No transactions yet" /> : (
        <div className="card -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="table-cell">Job</th><th className="table-cell">Value</th><th className="table-cell">Date</th><th className="table-cell">Status</th></tr></thead>
            <tbody>{txs.map((t) => <tr key={t.id} className="border-b border-slate-100"><td className="table-cell">{t.description}</td><td className="table-cell"><Money cents={t.finalCents} recurrence={t.recurrence} /></td><td className="table-cell">{new Date(t.createdAt).toLocaleDateString("en-AU")}</td><td className="table-cell"><TxBadge status={t.status} /></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
