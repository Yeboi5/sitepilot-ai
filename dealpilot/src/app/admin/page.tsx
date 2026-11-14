import { Badge, Card, Flash, Money, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { dataDriver, aiProviderName, feeConfig } from "@/lib/config";
import { flash, type SearchParams } from "@/lib/page";
import { listAudit } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { listLedger } from "@/lib/services/transactions";
import { resetDemoAction } from "../actions/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit & ledger" };

export default async function Admin({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("admin");
  const ctx = await appCtx();
  const [audit, ledger] = await Promise.all([listAudit(ctx, actor, 300), listLedger(ctx, actor)]);
  const fees = ledger.filter((e) => e.type === "fee_assessed").reduce((s, e) => s + e.amountCents, 0);
  return (
    <>
      <PageHeader title="Audit log & ledger" subtitle={<>Driver: <Badge>{dataDriver()}</Badge> · AI: <Badge>{aiProviderName()}</Badge> · fee <Money cents={feeConfig().successFeeCents} /></>}
        actions={dataDriver() === "memory" && <form action={resetDemoAction}><button className="btn-danger" type="submit">Reset demo data</button></form>} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Audit log (latest ${audit.length})`}>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b uppercase text-slate-500"><th className="table-cell">When</th><th className="table-cell">Actor</th><th className="table-cell">Action</th><th className="table-cell">Entity</th></tr></thead>
              <tbody>{audit.map((a) => <tr key={a.id} className="border-b border-slate-100"><td className="table-cell whitespace-nowrap">{new Date(a.at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "medium" })}</td><td className="table-cell">{a.actorRole}</td><td className="table-cell font-mono">{a.action}</td><td className="table-cell font-mono text-slate-500" title={JSON.stringify(a.detail ?? {})}>{a.entityType}:{a.entityId.slice(-6)}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Card title="Platform ledger" action={<span className="text-sm">Fees assessed: <Money cents={fees} /> <Badge tone="amber">Not collected</Badge></span>}>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b uppercase text-slate-500"><th className="table-cell">When</th><th className="table-cell">Type</th><th className="table-cell text-right">Amount</th><th className="table-cell">Key</th></tr></thead>
              <tbody>{ledger.map((e) => <tr key={e.id} className="border-b border-slate-100"><td className="table-cell whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString("en-AU")}</td><td className="table-cell">{e.type}</td><td className="table-cell text-right"><Money cents={e.amountCents} /></td><td className="table-cell font-mono text-slate-500">{e.idempotencyKey.slice(0, 18)}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
