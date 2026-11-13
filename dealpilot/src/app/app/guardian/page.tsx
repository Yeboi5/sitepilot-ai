import { Badge, Card, Empty, Flash, Money, PageHeader, Provenance } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { guardianReport } from "@/lib/services/monitoring";
import { addExpenseAction, importCsvAction } from "../../actions/customer";

export const metadata = { title: "Money Guardian" };

const KIND = { duplicate_charge: ["red", "Possible duplicate"], subscription: ["blue", "Recurring"], price_creep: ["amber", "Price increase"] } as const;

export default async function Guardian({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const r = await guardianReport(await appCtx(), actor);
  return (
    <>
      <PageHeader title="AI Money Guardian" subtitle="Find duplicate charges, forgotten subscriptions and creeping prices in statements you upload." />
      <Flash error={f.error} notice={f.notice} />
      <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <strong>Your money stays yours.</strong> DealPilot never asks for banking passwords, never connects to your bank in this prototype, and never moves money. Read-only Consumer Data Right access is a <Provenance kind="future" />.
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Findings (${r.findings.length})`} action={<span className="text-sm">Avoidable: <Money cents={r.potentialAnnualCents} className="font-semibold" />/yr</span>}>
            {r.findings.length === 0 ? <Empty title="No issues found">Upload a statement CSV to analyse.</Empty> : (
              <ul className="space-y-2">
                {r.findings.map((x, i) => (
                  <li key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{x.title}</p>
                      <Badge tone={KIND[x.kind][0]}>{KIND[x.kind][1]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{x.detail}</p>
                    {x.kind !== "duplicate_charge" && <a className="mt-2 inline-block text-sm text-brand-700 underline" href={`/app/negotiations/new?category=subscriptions&baseline=${(x.lines[x.lines.length - 1].amountCents / 100).toFixed(2)}&recurrence=monthly`}>Negotiate or cancel →</a>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Expense lines">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="table-cell">Date</th><th className="table-cell">Merchant</th><th className="table-cell text-right">Amount</th><th className="table-cell">Source</th></tr></thead>
                <tbody>{r.lines.map((l) => <tr key={l.id} className="border-b border-slate-100"><td className="table-cell">{l.date}</td><td className="table-cell">{l.merchant}</td><td className="table-cell text-right"><Money cents={l.amountCents} /></td><td className="table-cell text-xs text-slate-500">{l.source.replace("_", " ")}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Upload statement CSV">
            <form action={importCsvAction} className="space-y-3">
              <input className="input" type="file" name="file" accept=".csv,text/csv" aria-label="CSV file" />
              <p className="text-xs text-slate-500">Or paste rows: <code>date,merchant,amount</code></p>
              <textarea className="input font-mono text-xs" name="csv" rows={4} placeholder={"2026-11-01,StreamFlix,24.99"} aria-label="CSV rows" />
              <button className="btn-primary w-full" type="submit">Import</button>
              <p className="text-xs text-slate-500">Remove account numbers before uploading. Rows that look like account numbers are rejected.</p>
            </form>
          </Card>
          <Card title="Add one expense">
            <form action={addExpenseAction} className="space-y-2">
              <input className="input" name="date" type="date" required aria-label="Date" />
              <input className="input" name="merchant" placeholder="Merchant" required />
              <input className="input" name="amount" inputMode="decimal" placeholder="Amount" required />
              <button className="btn-secondary w-full" type="submit">Add</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
