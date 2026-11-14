import { CategorySelect, RecurrenceSelect } from "@/components/category-select";
import { Card, DemoNote, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { MODE_LABELS } from "@/lib/domain/negotiation";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listDocuments } from "@/lib/services/documents";
import { startNegotiationAction } from "../../../actions/customer";

export const metadata = { title: "Negotiate a bill" };

export default async function NewNegotiation({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { user, actor } = await requireUser("customer");
  const docs = await listDocuments(await appCtx(), actor);
  const docId = f.get("documentId");
  const doc = docs.find((d) => d.id === docId);
  return (
    <>
      <PageHeader title="Negotiate a bill or contract" subtitle="Internet, mobile, energy, insurance, subscriptions — anything you already pay for." />
      <Flash error={f.error} />
      <Card>
        <form action={startNegotiationAction} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="categoryId">Category</label><CategorySelect defaultValue={f.get("category") ?? doc?.categoryId} /></div>
          <div><label className="label" htmlFor="counterparty">Current provider</label><input className="input" id="counterparty" name="counterparty" required defaultValue={doc?.analysis?.vendor?.replace(/\s*\(.*\)$/, "") ?? ""} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" placeholder="e.g. Home internet" /></div>
          <div><label className="label" htmlFor="baseline">What you pay now (AUD)</label><input className="input" id="baseline" name="baseline" inputMode="decimal" required defaultValue={f.get("baseline") && f.get("baseline") !== "0" ? f.get("baseline") : ""} /></div>
          <div><label className="label" htmlFor="recurrence">Billing</label><RecurrenceSelect defaultValue={f.get("recurrence") ?? "monthly"} /></div>
          <div><label className="label" htmlFor="target">Target price (optional)</label><input className="input" id="target" name="target" inputMode="decimal" placeholder="AI suggests one if blank" defaultValue={f.get("target") ?? ""} /></div>
          <div>
            <label className="label" htmlFor="mode">AI permission mode</label>
            <select className="input" id="mode" name="mode" defaultValue={user.permissionMode}>
              {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="documentId">Bill or contract</label>
            <select className="input" id="documentId" name="documentId" defaultValue={docId ?? ""}>
              <option value="">None</option>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><DemoNote>DealPilot has no authorised integrations with external providers yet, so their replies are <strong>simulated</strong>. Nothing is sent to a real company.</DemoNote></div>
          <div><button className="btn-primary" type="submit">Start negotiation</button></div>
        </form>
      </Card>
    </>
  );
}
