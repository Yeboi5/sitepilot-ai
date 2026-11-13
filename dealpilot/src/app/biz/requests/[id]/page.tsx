import { Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Flash, Money, PageHeader, Provenance } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { BidDraft, decodeDraft } from "@/lib/draft-param";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { getRequestForBusiness } from "@/lib/services/marketplace";
import { draftBidAction, submitOfferAction, withdrawOfferAction } from "../../../actions/business";

export const metadata = { title: "Request" };

export default async function BizRequest({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const data = await getRequestForBusiness(await appCtx(), actor, id).catch(() => null);
  if (!data) notFound();
  const { request: r, category, myOffer, competing, business } = data;
  const draft = decodeDraft(f.get("draft"), BidDraft);
  const canSubmit = !myOffer || ["draft", "withdrawn", "expired"].includes(myOffer.status);
  return (
    <>
      <PageHeader title={r.title} subtitle={<>{category.name} · {r.region} · {competing} competing offer{competing === 1 ? "" : "s"} (sealed)</>} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Request details">
          <p className="text-sm text-slate-700">{r.description || "No description."}</p>
          <dl className="mt-3 space-y-1 text-sm">
            {Object.entries(r.fields).map(([k, v]) => {
              const def = category.fields.find((x) => x.key === k);
              return <div key={k} className="flex justify-between gap-2"><dt className="text-slate-500">{def?.label ?? k}</dt><dd>{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)} {def?.unit}</dd></div>;
            })}
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-2"><dt className="text-slate-500">Customer&apos;s current price</dt><dd className="font-semibold"><Money cents={r.baselineCents} recurrence={r.recurrence} /></dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Customer identity is shared only once they accept your offer.</p>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          {myOffer && !canSubmit ? (
            <Card title="Your offer" action={<Badge tone="blue">{myOffer.status}</Badge>}>
              <p className="text-2xl font-bold"><Money cents={myOffer.priceCents} recurrence={myOffer.recurrence} /></p>
              <p className="mt-1 text-sm text-slate-600">{myOffer.scope}</p>
              <p className="mt-1 text-xs text-slate-500">{myOffer.warrantyMonths} months warranty · {myOffer.completionDays} days · {myOffer.aiDrafted ? "AI-assisted, " : ""}approved {myOffer.approvedAt && new Date(myOffer.approvedAt).toLocaleDateString("en-AU")}</p>
              <div className="mt-3 flex gap-2">
                <Link className="btn-secondary" href="/biz/inbox">Negotiation inbox</Link>
                {myOffer.status !== "accepted" && <form action={withdrawOfferAction}><input type="hidden" name="offerId" value={myOffer.id} /><input type="hidden" name="requestId" value={r.id} /><button className="btn-danger" type="submit">Withdraw</button></form>}
              </div>
            </Card>
          ) : (
            <Card title="Submit an offer" action={<form action={draftBidAction}><input type="hidden" name="requestId" value={r.id} /><button className="btn-secondary px-3 py-1.5" type="submit"><Sparkles className="h-4 w-4" /> Draft with AI</button></form>}>
              {draft && (
                <div className="mb-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                  <p className="flex items-center gap-2 font-medium">AI draft loaded {draft.simulated ? <Provenance kind="simulated">Offline AI</Provenance> : <Badge tone="violet">{draft.provider}</Badge>}</p>
                  <p className="mt-1">{draft.rationale}</p>
                  <p className="mt-1 text-xs">Review every field. Nothing is sent until you approve.</p>
                </div>
              )}
              <form action={submitOfferAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="requestId" value={r.id} />
                <input type="hidden" name="aiDrafted" value={draft ? "1" : "0"} />
                <div><label className="label" htmlFor="price">Total price (AUD)</label><input className="input" id="price" name="price" inputMode="decimal" required defaultValue={draft ? (draft.priceCents / 100).toFixed(2) : ""} /></div>
                <div><label className="label" htmlFor="validDays">Valid for (days)</label><input className="input" id="validDays" name="validDays" inputMode="numeric" defaultValue="14" /></div>
                <div className="sm:col-span-2"><label className="label" htmlFor="scope">Scope</label><textarea className="input" id="scope" name="scope" rows={3} required defaultValue={draft?.scope} /></div>
                <div className="sm:col-span-2"><label className="label" htmlFor="materials">Materials / specifications</label><input className="input" id="materials" name="materials" defaultValue={draft?.materials} /></div>
                <div><label className="label" htmlFor="warranty">Warranty (months)</label><input className="input" id="warranty" name="warranty" inputMode="numeric" defaultValue={draft?.warrantyMonths ?? 0} /></div>
                <div><label className="label" htmlFor="days">{category.completionLabel} (days)</label><input className="input" id="days" name="days" inputMode="numeric" defaultValue={draft?.completionDays ?? 7} /></div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="insurance" defaultChecked={business.insured} disabled={!business.insured} /> Work covered by our insurance {!business.insured && <span className="text-xs text-red-700">(add insurance in your profile first)</span>}</label>
                <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm sm:col-span-2"><input type="checkbox" name="approve" required className="mt-1" /> I am a person authorised by {business.name} and I approve this offer. It is a genuine, binding quote.</label>
                <div><button className="btn-primary" type="submit">Submit offer</button></div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
