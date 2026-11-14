import { Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Flash, Money, PageHeader, Provenance, StateBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { CounterDraft, decodeDraft } from "@/lib/draft-param";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { getBusinessNegotiation } from "@/lib/services/negotiations";
import { FinalTermsCard } from "@/components/final-terms";
import { approveTermsBizAction, draftCounterAction, respondAction } from "../../../actions/business";

export const metadata = { title: "Negotiation" };

export default async function BizNegotiation({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const n = await getBusinessNegotiation(await appCtx(), actor, id).catch(() => null);
  if (!n) notFound();
  const draft = decodeDraft(f.get("draft"), CounterDraft);
  const lastAsk = [...n.messages].reverse().find((m) => m.kind === "sent" && m.amountCents !== undefined)?.amountCents;
  const canRespond = n.state === "awaiting_counterparty";
  return (
    <>
      <PageHeader title={n.title} subtitle={<span className="flex items-center gap-2">Customer negotiation <StateBadge state={n.state} /></span>} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="card p-3"><p className="text-xs text-slate-500">Your current offer</p><p className="font-semibold"><Money cents={n.agreedCents ?? n.currentOfferCents} recurrence={n.recurrence} /></p></div>
            <div className="card p-3"><p className="text-xs text-slate-500">Customer asked for</p><p className="font-semibold">{lastAsk !== undefined ? <Money cents={lastAsk} recurrence={n.recurrence} /> : "—"}</p></div>
          </div>
          {n.finalTerms && ["final_approval", "agreed", "completed"].includes(n.state) && <FinalTermsCard n={n} side="business" action={approveTermsBizAction} />}
          <Card title="Messages">
            <ol className="space-y-3">
              {n.messages.map((m) => (
                <li key={m.id} className={`rounded-xl p-3 ring-1 ${m.from === "business" ? "bg-brand-50 ring-brand-200" : "bg-white ring-slate-200"}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{m.from === "business" ? "You" : "Customer"}</span><Badge>{m.kind}</Badge>
                    {m.amountCents !== undefined && <Money cents={m.amountCents} recurrence={n.recurrence} className="font-semibold text-slate-800" />}
                    <span className="ml-auto">{new Date(m.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-4">
          {canRespond ? (
            <>
              <Card title="AI counteroffer assistant">
                <form action={draftCounterAction} className="space-y-2">
                  <input type="hidden" name="id" value={n.id} />
                  <label className="label" htmlFor="minimum">Lowest price you&apos;d accept (private)</label>
                  <input className="input" id="minimum" name="minimum" inputMode="decimal" required defaultValue={lastAsk !== undefined ? ((lastAsk + n.currentOfferCents) / 200).toFixed(2) : ""} />
                  <button className="btn-secondary w-full" type="submit"><Sparkles className="h-4 w-4" /> Draft counteroffer</button>
                </form>
                {draft && <p className="mt-3 flex items-center gap-2 text-xs text-violet-800">Draft loaded below <Provenance kind="simulated">review before sending</Provenance></p>}
              </Card>
              <Card title="Respond">
                <form action={respondAction} className="space-y-3">
                  <input type="hidden" name="id" value={n.id} />
                  <fieldset className="space-y-1 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" name="action" value="counter" defaultChecked /> Counteroffer</label>
                    <label className="flex items-center gap-2"><input type="radio" name="action" value="accept" /> Accept customer&apos;s price{lastAsk !== undefined && <> (<Money cents={lastAsk} />)</>}</label>
                    <label className="flex items-center gap-2"><input type="radio" name="action" value="decline" /> Decline</label>
                  </fieldset>
                  <div><label className="label" htmlFor="price">Counteroffer price</label><input className="input" id="price" name="price" inputMode="decimal" defaultValue={draft ? (draft.priceCents / 100).toFixed(2) : ""} /></div>
                  <div><label className="label" htmlFor="message">Message</label><textarea className="input" id="message" name="message" rows={4} defaultValue={draft?.message} /></div>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="approve" required className="mt-1" /> I approve this response on behalf of my business.</label>
                  <button className="btn-primary w-full" type="submit">Send response</button>
                </form>
              </Card>
            </>
          ) : (
            <Card title="Status"><p className="text-sm text-slate-600">{n.state === "final_approval" ? "Final terms are awaiting approval — see above." : n.state === "agreed" || n.state === "completed" ? "Deal agreed by both parties. The customer will confirm the final invoice." : n.state === "counter_received" ? "Waiting for the customer to respond to your counteroffer." : "No action needed."}</p></Card>
          )}
          <Link href="/biz/inbox" className="text-sm text-brand-700">← Inbox</Link>
        </div>
      </div>
    </>
  );
}
