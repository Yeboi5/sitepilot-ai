import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Flash, LinkButton, Money, PageHeader, Provenance } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { getDocument } from "@/lib/services/documents";

export const metadata = { title: "Document analysis" };

export default async function DocumentPage({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const doc = await getDocument(await appCtx(), actor, id).catch(() => null);
  if (!doc) notFound();
  const a = doc.analysis;
  const category = getCategory(doc.categoryId);
  const recurring = a?.recurrence && a.recurrence !== "one_off";
  const q = new URLSearchParams({ category: doc.categoryId, documentId: doc.id, baseline: String((a?.totalCents ?? 0) / 100), recurrence: a?.recurrence ?? "one_off" });
  return (
    <>
      <PageHeader
        title={doc.filename}
        subtitle={<>{category.name} · {doc.kind} · <a className="text-brand-700 underline" href={`/api/documents/${doc.id}`}>download (private)</a></>}
        actions={<>
          {recurring || ["telco", "energy", "insurance", "subscriptions"].includes(doc.categoryId)
            ? <LinkButton href={`/app/negotiations/new?${q}`}>Negotiate this bill</LinkButton>
            : <LinkButton href={`/app/requests/new?${q}`}>Get competing bids</LinkButton>}
          <LinkButton variant="secondary" href={`/app/monitor`}>Track price</LinkButton>
        </>}
      />
      <Flash error={f.error} notice={f.notice} />
      {!a ? <Card>No analysis available.</Card> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="AI analysis" action={<span className="flex gap-1"><Badge tone="slate">{a.provider}</Badge>{a.simulated && <Provenance kind="simulated">Benchmarks simulated</Provenance>}</span>}>
            <p className="text-sm text-slate-700">{a.summary}</p>
            {a.lineItems.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="table-cell">Line item</th><th className="table-cell text-right">Amount</th></tr></thead>
                <tbody>
                  {a.lineItems.map((l, i) => <tr key={i} className="border-b border-slate-100"><td className="table-cell">{l.description}</td><td className="table-cell text-right"><Money cents={l.amountCents} /></td></tr>)}
                  {a.totalCents !== undefined && <tr className="font-semibold"><td className="table-cell">Total</td><td className="table-cell text-right"><Money cents={a.totalCents} recurrence={a.recurrence} /></td></tr>}
                </tbody>
              </table>
            )}
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
