import Link from "next/link";
import { RecurrenceSelect } from "@/components/category-select";
import { Card, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { CATEGORIES, getCategory, isCategory } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listDocuments } from "@/lib/services/documents";
import { createRequestAction } from "../../../actions/customer";

export const metadata = { title: "New request" };

export default async function NewRequest({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { user, actor } = await requireUser("customer");
  const categoryId = f.get("category");
  if (!categoryId || !isCategory(categoryId)) {
    return (
      <>
        <PageHeader title="What do you want to buy or reprice?" subtitle="Pick a category. Each has its own details and comparison rules." />
        <Flash error={f.error} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link key={c.id} href={`/app/requests/new?category=${c.id}`} className="card hover:border-brand-300">
              <p className="font-semibold">{c.name}</p>
              <p className="mt-1 text-sm text-slate-600">{c.description}</p>
            </Link>
          ))}
        </div>
      </>
    );
  }
  const category = getCategory(categoryId);
  const docs = (await listDocuments(await appCtx(), actor)).filter((d) => d.categoryId === categoryId);
  const documentId = f.get("documentId");
  return (
    <>
      <PageHeader title={`New request: ${category.name}`} subtitle={<Link href="/app/requests/new" className="text-brand-700">Change category</Link>} />
      <Flash error={f.error} />
      <Card>
        <form action={createRequestAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="categoryId" value={category.id} />
          <div className="sm:col-span-2"><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" required placeholder="e.g. Replace 30m side fence" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="description">Description</label><textarea className="input" id="description" name="description" rows={3} /></div>
          {category.fields.map((fd) => (
            <div key={fd.key} className={fd.type === "boolean" ? "flex items-center gap-2 pt-6" : ""}>
              {fd.type === "boolean" ? (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`f_${fd.key}`} /> {fd.label}</label>
              ) : (
                <>
                  <label className="label" htmlFor={`f_${fd.key}`}>{fd.label}{fd.required && " *"}{fd.unit && <span className="font-normal text-slate-500"> ({fd.unit})</span>}</label>
                  {fd.type === "select" ? (
                    <select className="input" id={`f_${fd.key}`} name={`f_${fd.key}`} required={fd.required} defaultValue="">
                      <option value="">—</option>
                      {fd.options!.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="input" id={`f_${fd.key}`} name={`f_${fd.key}`} required={fd.required} inputMode={fd.type === "number" ? "decimal" : undefined} />
                  )}
                </>
              )}
            </div>
          ))}
          <div><label className="label" htmlFor="baseline">Your current price or best quote (AUD) *</label><input className="input" id="baseline" name="baseline" inputMode="decimal" required defaultValue={f.get("baseline") && f.get("baseline") !== "0" ? f.get("baseline") : ""} /></div>
          <div><label className="label" htmlFor="recurrence">Billing</label><RecurrenceSelect defaultValue={f.get("recurrence") ?? category.defaultRecurrence} /></div>
          <div><label className="label" htmlFor="region">Region</label><input className="input" id="region" name="region" defaultValue={user.region} /></div>
          <div>
            <label className="label" htmlFor="documentId">Attach a document</label>
            <select className="input" id="documentId" name="documentId" defaultValue={documentId ?? ""}>
              <option value="">None</option>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
            </select>
          </div>
          <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm sm:col-span-2">
            <input type="checkbox" name="simulateBids" defaultChecked />
            <span>Also invite <strong>simulated</strong> demo providers to bid, so you can try the comparison. Their offers are fictional and labelled.</span>
          </label>
          <div className="sm:col-span-2"><button className="btn-primary" type="submit">Post request</button></div>
        </form>
      </Card>
      {category.notes && <p className="mt-3 text-xs text-slate-500">{category.notes}</p>}
    </>
  );
}
