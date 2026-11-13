import Link from "next/link";
import { CategorySelect } from "@/components/category-select";
import { Badge, Card, Empty, Flash, Money, PageHeader, Provenance, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { aiProviderName } from "@/lib/config";
import { getCategory } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listDocuments } from "@/lib/services/documents";
import { uploadDocumentAction } from "../../actions/customer";

export const metadata = { title: "Documents" };

export default async function Documents({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const docs = await listDocuments(await appCtx(), actor);
  const provider = aiProviderName();
  return (
    <>
      <PageHeader title="Documents" subtitle="Bills, quotes, receipts and contracts. Stored privately — only you can open them." />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" title="Upload & analyse" action={provider === "anthropic" ? <Provenance kind="live">AI: Anthropic</Provenance> : <Provenance kind="simulated">AI: offline demo</Provenance>}>
          <form action={uploadDocumentAction} className="space-y-3">
            <div><label className="label" htmlFor="file">File</label><input className="input" id="file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv" required /><p className="mt-1 text-xs text-slate-500">PDF, image, TXT or CSV up to 8 MB.</p></div>
            <div><label className="label" htmlFor="categoryId">Category</label><CategorySelect /></div>
            <div>
              <label className="label" htmlFor="kind">Document type</label>
              <select className="input" id="kind" name="kind" defaultValue="quote">
                {["quote", "bill", "receipt", "contract", "invoice", "statement", "other"].map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="statedAmount">Amount on the document (optional)</label><input className="input" id="statedAmount" name="statedAmount" inputMode="decimal" placeholder="e.g. 5500" /><p className="mt-1 text-xs text-slate-500">Used if the analyser can&apos;t read the file.</p></div>
            <button className="btn-primary w-full" type="submit">Upload & analyse</button>
            {provider !== "anthropic" && <p className="text-xs text-slate-500">The offline analyser reads text files only and uses simulated benchmark ranges. Set <code>AI_PROVIDER=anthropic</code> to analyse PDFs and images.</p>}
          </form>
        </Card>
        <div className="lg:col-span-3">
          {docs.length === 0 ? <Empty title="No documents yet">Upload a quote or bill to see what a fair price looks like.</Empty> : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <Link href={`/app/documents/${d.id}`} className="card flex items-center justify-between gap-3 hover:border-brand-300">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.filename}</p>
                      <p className="text-xs text-slate-500">{getCategory(d.categoryId).name} · {d.kind} · uploaded {relTime(d.uploadedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {d.analysis?.totalCents !== undefined && <Money cents={d.analysis.totalCents} className="font-semibold" />}
                      {d.isDemo && <Badge tone="amber">Demo</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
