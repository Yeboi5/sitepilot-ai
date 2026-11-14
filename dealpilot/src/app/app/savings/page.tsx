import Link from "next/link";
import { Badge, Card, Empty, Flash, Money, PageHeader, Stat, TxBadge } from "@/components/ui";
import { VerifyForm } from "@/components/verify-form";
import { leaveReviewAction } from "../../actions/customer";
import { requireUser } from "@/lib/auth/session";
import { feeConfig } from "@/lib/config";
import { getCategory } from "@/lib/domain/categories";
import { monthlyEquivalent } from "@/lib/domain/savings";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listDocuments } from "@/lib/services/documents";
import { listCustomerTransactions, listLedger } from "@/lib/services/transactions";

export const metadata = { title: "Savings & ledger" };

export default async function Savings({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const ctx = await appCtx();
  const [{ transactions, summary }, ledger, docs, reviews] = await Promise.all([listCustomerTransactions(ctx, actor), listLedger(ctx, actor), listDocuments(ctx, actor), ctx.store.list("reviews", { customerId: actor.userId })]);
  const reviewable = transactions.filter((t) => t.status === "verified" && !t.simulated && t.businessId && !reviews.some((r) => r.transactionId === t.id));
  const fee = feeConfig();
  const pending = transactions.filter((t) => t.status === "pending_verification");
  return (
    <>
      <PageHeader title="Savings & transactions" subtitle={<>Savings count only once you verify the final amount. A <Money cents={fee.successFeeCents} /> fee applies once per completed, verified qualifying saving, capped at the amount saved. No saving, no fee. Fees are assessed but not charged during launch.</>} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat tone="brand" label="Realised (verified)" value={<Money cents={summary.realisedCents} />} hint="Money you've actually saved" />
        <Stat label="Recurring / month" value={<Money cents={summary.monthlyRecurringCents} />} />
        <Stat label="Projected 12 months" value={<Money cents={summary.projectedAnnualCents} />} hint="Projection, not yet realised" />
        <Stat label="Pending" value={<Money cents={summary.pendingCents} />} hint={`${summary.pendingCount} to verify`} />
        <Stat label="Fees assessed" value={<Money cents={summary.feesAssessedCents} />} hint="Not charged during launch" />
      </div>

      {pending.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Waiting for your confirmation</h2>
          {pending.map((t) => (
            <Card key={t.id} title={t.description} action={<TxBadge status={t.status} />}>
              <VerifyForm tx={t} docs={docs} back="/app/savings" feeCents={fee.successFeeCents} />
            </Card>
          ))}
        </div>
      )}

      {reviewable.length > 0 && (
        <Card title="Review your verified jobs" className="mt-6">
          <p className="mb-3 text-sm text-slate-600">Only customers with a verified, completed DealPilot job can review a business, so ratings can be trusted.</p>
          {reviewable.map((t) => (
            <form key={t.id} action={leaveReviewAction} className="mb-3 grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-6">
              <input type="hidden" name="txId" value={t.id} />
              <p className="text-sm font-medium sm:col-span-6">{t.description}</p>
              <select className="input" name="rating" defaultValue="5" aria-label="Rating">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
              <input className="input sm:col-span-4" name="comment" placeholder="How did it go? (optional)" />
              <button className="btn-secondary" type="submit">Post review</button>
            </form>
          ))}
        </Card>
      )}

      <Card title="Savings history" className="mt-6">
        {transactions.length === 0 ? <Empty title="No transactions yet" /> : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="table-cell">Deal</th><th className="table-cell">Before</th><th className="table-cell">After</th><th className="table-cell">Realised</th><th className="table-cell">Per month</th><th className="table-cell">Projected 12 mo</th><th className="table-cell">Fee</th><th className="table-cell">Status</th></tr></thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="table-cell"><p className="font-medium">{t.negotiationId ? <Link className="hover:underline" href={`/app/negotiations/${t.negotiationId}`}>{t.description}</Link> : t.description}</p><p className="text-xs text-slate-500">{getCategory(t.categoryId).name} · {new Date(t.createdAt).toLocaleDateString("en-AU")} {t.simulated && <Badge tone="amber">Simulated</Badge>}</p></td>
                    <td className="table-cell"><Money cents={t.baselineCents} recurrence={t.recurrence} /></td>
                    <td className="table-cell"><Money cents={t.finalCents} recurrence={t.recurrence} /></td>
                    <td className="table-cell font-semibold text-brand-700">{t.status === "verified" ? <Money cents={t.periodSavingsCents} /> : <span className="text-slate-400">—</span>}</td>
                    <td className="table-cell">{t.recurrence === "one_off" ? "—" : <Money cents={monthlyEquivalent(t.periodSavingsCents, t.recurrence)} />}</td>
                    <td className="table-cell text-slate-600">{t.recurrence === "one_off" ? "—" : <Money cents={t.annualSavingsCents} />}</td>
                    <td className="table-cell"><Money cents={t.feeCents} /> <span className="block text-xs text-slate-500" title={t.feeReason}>{t.feeStatus.replace(/_/g, " ")}</span></td>
                    <td className="table-cell"><TxBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Ledger (append-only)" className="mt-6">
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="table-cell">When</th><th className="table-cell">Entry</th><th className="table-cell text-right">Amount</th><th className="table-cell">Note</th></tr></thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="table-cell text-xs">{new Date(e.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="table-cell">{e.type.replace(/_/g, " ")} {e.simulated && <Badge tone="amber">Simulated</Badge>}</td>
                  <td className="table-cell text-right"><Money cents={e.amountCents} /></td>
                  <td className="table-cell text-xs text-slate-500">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
