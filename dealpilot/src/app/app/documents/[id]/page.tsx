import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Flash, LinkButton, Money, PageHeader, Provenance, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { getDocument } from "@/lib/services/documents";
import { confirmExtractionAction } from "../../../actions/customer";

export const metadata = { title: "Document analysis" };

export default async function DocumentPage({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const doc = await getDocument(await appCtx(), actor, id).catch(() => null);
  if (!doc) notFound();
  const a = doc.analysis;
  const category = getCategory(doc.categoryId);
  // Downstream steps use the customer-confirmed values, never the raw AI output.
  const c = doc.confirmed;
  const recurring = c ? c.recurrence !== "one_off" : a?.recurrence && a.recurrence !== "one_off";
  const q = new URLSearchParams({ category: doc.categoryId, documentId: doc.id, baseline: String((c?.totalCents ?? 0) / 100), recurrence: c?.recurrence ?? "one_off" });
  const items = c?.lineItems ?? a?.lineItems ?? [];
  return (
    <>
      <PageHeader
        title={doc.filename}
        subtitle={<>{category.name} · {doc.kind} · <a className="text-brand-700 underline" href={`/api/documents/${doc.id}`}>download (private)</a></>}
        actions={c ? <>
          {recurring || ["telco", "energy", "insurance", "subscriptions"].includes(doc.categoryId)
            ? <LinkButton href={`/app/negotiations/new?${q}`}>Negotiate this bill</LinkButton>
            : <LinkButton href={`/app/requests/new?${q}`}>Get competing bids</LinkButton>}
          <LinkButton variant="secondary" href={`/app/monitor`}>Track price</LinkButton>
        </> : <Badge tone="amber">Review the details below to continue</Badge>}
      />
      <Flash error={f.error} notice={f.notice} />
      {!a ? <Card>No analysis available.</Card> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="AI extraction — review & confirm" action={<span className="flex gap-1"><Badge tone="slate">{a.provider}</Badge>{a.simulated && <Provenance kind="simulated">Benchmarks simulated</Provenance>}</span>}>
            <p className="text-sm text-slate-700">{a.summary}</p>
            <form action={confirmExtractionAction} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={doc.id} />
              <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                {c ? <>You confirmed these details {relTime(doc.confirmedAt!)}. You can still correct them.</> : <>AI can make mistakes. <strong>Check and correct</strong> the details below — DealPilot only uses what you confirm.</>}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="label" htmlFor="vendor">Provider / vendor</label><input className="input" id="vendor" name="vendor" defaultValue={c?.vendor ?? a.vendor ?? ""} /></div>
                <div><label className="label" htmlFor="total">Total (AUD)</label><input className="input" id="total" name="total" inputMode="decimal" defaultValue={((c?.totalCents ?? a.totalCents ?? 0) / 100 || "").toString()} /></div>
                <div>
                  <label className="label" htmlFor="recurrence">Billing</label>
                  <select className="input" id="recurrence" name="recurrence" defaultValue={c?.recurrence ?? a.recurrence ?? "one_off"}>
                    <option value="one_off">One-off</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="table-cell">Line item</th><th className="table-cell w-32 text-right">Amount</th></tr></thead>
                <tbody>
                  {[...items, { description: "", amountCents: 0 }, { description: "", amountCents: 0 }].map((l, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1 pr-2"><input className="input py-1" name={`li_desc_${i}`} defaultValue={l.description} aria-label={`Line item ${i + 1}`} /></td>
                      <td className="py-1"><input className="input py-1 text-right" name={`li_amt_${i}`} inputMode="decimal" defaultValue={l.description ? (l.amountCents / 100).toFixed(2) : ""} aria-label={`Amount ${i + 1}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div><label className="label" htmlFor="notes">Notes (optional)</label><input className="input" id="notes" name="notes" defaultValue={c?.notes ?? ""} /></div>
              <button className="btn-primary" type="submit">{c ? "Save corrections" : "Confirm details"}</button>
            </form>
          </Card>
          <div className="space-y-4">
            {a.benchmarkLowCents !== undefined && a.benchmarkHighCents !== undefined && (
              <Card title="Fair price range" action={<Provenance kind="simulated" />}>
                <p className="text-2xl font-bold"><Money cents={a.benchmarkLowCents} /> – <Money cents={a.benchmarkHighCents} /></p>
                <p className="mt-1 text-xs text-slate-500">Illustrative range for {category.name.toLowerCase()} — not real market data yet.</p>
                {a.totalCents !== undefined && a.totalCents > a.benchmarkHighCents && <p className="mt-2 text-sm font-medium text-amber-800">You may be paying up to <Money cents={a.totalCents - a.benchmarkLowCents} /> too much.</p>}
              </Card>
            )}
            <Card title="Risks to check">
              {a.risks.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{a.risks.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-sm text-slate-600">None found.</p>}
            </Card>
            <Card title="Key terms">
              {a.keyTerms.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{a.keyTerms.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-sm text-slate-600">None found.</p>}
            </Card>
            {category.notes && <p className="text-xs text-slate-500">{category.notes}</p>}
          </div>
        </div>
      )}
      <p className="mt-6 text-sm"><Link href="/app/documents" className="text-brand-700">← All documents</Link></p>
    </>
  );
}
