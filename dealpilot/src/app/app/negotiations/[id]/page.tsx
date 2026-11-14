import { Bot, Building2, Info, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, cx, DemoNote, Flash, Money, PageHeader, Provenance, StateBadge, TxBadge } from "@/components/ui";
import { FinalTermsCard } from "@/components/final-terms";
import { VerifyForm } from "@/components/verify-form";
import { requireUser } from "@/lib/auth/session";
import { feeConfig } from "@/lib/config";
import { MODE_LABELS } from "@/lib/domain/negotiation";
import { calculateSavings } from "@/lib/domain/savings";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listDocuments } from "@/lib/services/documents";
import { getCustomerNegotiation } from "@/lib/services/negotiations";
import {
  acceptNegotiationAction, approveDraftAction, approveTermsAction, discardDraftAction, prepareActionAction, recordReplyAction, setModeAction, setTargetAction, walkAwayAction,
} from "../../../actions/customer";

export const metadata = { title: "Negotiation" };

const AUTHOR = {
  ai: { icon: Bot, label: "DealPilot AI", cls: "bg-violet-50 ring-violet-200" },
  customer: { icon: User, label: "You", cls: "bg-brand-50 ring-brand-200" },
  business: { icon: Building2, label: "Counterparty", cls: "bg-white ring-slate-200" },
  system: { icon: Info, label: "System", cls: "bg-slate-50 ring-slate-200" },
};

export default async function NegotiationPage({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const ctx = await appCtx();
  const data = await getCustomerNegotiation(ctx, actor, id).catch(() => null);
  if (!data) notFound();
  const { negotiation: n, transaction: tx, recommendation } = data;
  const docs = await listDocuments(ctx, actor);
  const draft = n.messages.find((m) => m.pendingApproval);
  const s = calculateSavings(n.baselineCents, n.agreedCents ?? n.currentOfferCents, n.recurrence);
  const canDecide = ["open", "counter_received", "escalated"].includes(n.state);
  const external = n.simulated && !n.offerId;
  return (
    <>
      <PageHeader
        title={n.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{n.counterpartyName} <StateBadge state={n.state} /> {n.simulated ? <Provenance kind="simulated">Simulated counterparty</Provenance> : <Provenance kind="live">On-platform business</Provenance>}</span>}
      />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card p-3"><p className="text-xs text-slate-500">Was paying</p><p className="font-semibold"><Money cents={n.baselineCents} recurrence={n.recurrence} /></p></div>
            <div className="card p-3"><p className="text-xs text-slate-500">{n.agreedCents !== undefined ? "Agreed" : "Their offer"}</p><p className="font-semibold"><Money cents={n.agreedCents ?? n.currentOfferCents} recurrence={n.recurrence} /></p></div>
            {n.recurrence === "one_off" ? (
              <div className="card border-brand-200 bg-brand-50 p-3"><p className="text-xs text-slate-500">Saving</p><p className="font-semibold text-brand-800"><Money cents={s.periodSavingsCents} /></p></div>
            ) : (
              <div className="card border-brand-200 bg-brand-50 p-3"><p className="text-xs text-slate-500">Saving per month</p><p className="font-semibold text-brand-800"><Money cents={s.monthlySavingsCents} /></p><p className="text-[11px] text-slate-500">projected <Money cents={s.annualSavingsCents} />/yr</p></div>
            )}
          </div>

          {draft && n.state === "awaiting_approval" && (
            <Card title="AI draft — needs your approval" className="border-amber-300">
              <form action={approveDraftAction} className="space-y-3">
                <input type="hidden" name="id" value={n.id} /><input type="hidden" name="messageId" value={draft.id} />
                <p className="text-sm">{draft.amountCents !== undefined && draft.amountCents >= n.currentOfferCents ? "Accept" : "Ask for"} <Money cents={draft.amountCents ?? 0} recurrence={n.recurrence} className="font-semibold" /></p>
                <textarea className="input" name="body" rows={5} defaultValue={draft.body} aria-label="Message to send" />
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" required className="mt-1" /> I approve sending this message on my behalf{n.simulated ? " (to a simulated provider)" : ""}.</label>
                <div className="flex flex-wrap gap-2"><button className="btn-primary" type="submit">Approve & send</button></div>
              </form>
              <form action={discardDraftAction} className="mt-2"><input type="hidden" name="id" value={n.id} /><button className="text-sm text-slate-600 underline">Discard draft</button></form>
            </Card>
          )}

          {n.finalTerms && ["final_approval", "agreed", "completed"].includes(n.state) && <FinalTermsCard n={n} side="customer" action={approveTermsAction} />}

          {n.state === "agreed" && tx && (
            <Card title={<span className="flex items-center gap-2">Record & verify your saving <TxBadge status={tx.status} /></span>} className="border-brand-300">
              <VerifyForm tx={tx} docs={docs} back={`/app/negotiations/${n.id}`} feeCents={feeConfig().successFeeCents} />
            </Card>
          )}
          {tx && tx.status !== "pending_verification" && (
            <Card title="Outcome">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <TxBadge status={tx.status} /> Final <Money cents={tx.finalCents} recurrence={tx.recurrence} /> · realised saving <Money cents={tx.periodSavingsCents} />
                {tx.recurrence !== "one_off" && <> · projected <Money cents={tx.annualSavingsCents} /> over 12 months</>}
              </p>
              <p className="mt-1 text-xs text-slate-500">Fee: <Money cents={tx.feeCents} /> — {tx.feeReason ?? tx.feeStatus.replace(/_/g, " ")}{tx.feeStatus === "assessed" && ". Assessed only; nothing was charged."}</p>
              <Link href="/app/savings" className="mt-2 inline-block text-sm text-brand-700">View ledger →</Link>
            </Card>
          )}

          <Card title="Timeline">
            <ol className="space-y-3">
              {n.messages.map((m) => {
                const a = AUTHOR[m.from];
                const label = m.from === "business" ? n.counterpartyName : a.label;
                return (
                  <li key={m.id} className={cx("rounded-xl p-3 ring-1", a.cls, m.pendingApproval && "ring-2 ring-amber-400")}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <a.icon className="h-3.5 w-3.5" aria-hidden /> <span className="font-medium text-slate-700">{label}</span>
                      <Badge>{m.kind}</Badge>
                      {m.amountCents !== undefined && <Money cents={m.amountCents} recurrence={n.recurrence} className="font-semibold text-slate-800" />}
                      {m.simulated && <Badge tone="amber">Simulated</Badge>}
                      {m.pendingApproval && <Badge tone="amber">Awaiting approval</Badge>}
                      <span className="ml-auto">{new Date(m.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{m.body}</p>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          {canDecide && (
            <Card title="Next step">
              {recommendation && (
                <p className="mb-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                  <strong>Recommendation: {recommendation.action}</strong>{recommendation.priceCents !== undefined && <> at <Money cents={recommendation.priceCents} recurrence={n.recurrence} /></>}. {recommendation.reason}
                </p>
              )}
              <form action={prepareActionAction}><input type="hidden" name="id" value={n.id} /><button className="btn-primary w-full" type="submit">{n.mode === "advisory" ? "Get AI advice" : n.mode === "autopilot" ? "Run Limited Autopilot step" : "Prepare next step with AI"}</button></form>
              <form action={acceptNegotiationAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <input type="hidden" name="id" value={n.id} />
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" required className="mt-1" /> Accept <Money cents={n.currentOfferCents} recurrence={n.recurrence} /> now</label>
                <button className="btn-secondary w-full" type="submit">Accept current offer</button>
              </form>
              {external && (
                <form action={recordReplyAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <input type="hidden" name="id" value={n.id} />
                  <p className="text-xs text-slate-500">Got a reply by phone or email? Record it.</p>
                  <input className="input" name="amount" inputMode="decimal" placeholder="Amount offered" required />
                  <input className="input" name="note" placeholder="Note (optional)" />
                  <button className="btn-secondary w-full" type="submit">Record reply</button>
                </form>
              )}
            </Card>
          )}
          {n.state === "awaiting_counterparty" && <Card title="Waiting"><p className="text-sm text-slate-600">Your message was sent to {n.counterpartyName}. You&apos;ll get an alert when they reply.</p></Card>}

          <Card title="Settings">
            <form action={setModeAction} className="space-y-2">
              <input type="hidden" name="id" value={n.id} />
              <label className="label" htmlFor="mode">AI permission mode</label>
              <select className="input" id="mode" name="mode" defaultValue={n.mode}>{Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              <p className="text-xs text-slate-500">{MODE_LABELS[n.mode].description}</p>
              <button className="btn-secondary w-full" type="submit">Update mode</button>
            </form>
            <form action={setTargetAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={n.id} />
              <label className="label" htmlFor="target">Your target (private)</label>
              <input className="input" id="target" name="target" inputMode="decimal" defaultValue={(n.targetCents / 100).toFixed(2)} />
              <p className="text-xs text-slate-500">Never shown to the counterparty.</p>
              <button className="btn-secondary w-full" type="submit">Update target</button>
            </form>
            {!["completed", "declined", "cancelled", "expired", "agreed"].includes(n.state) && (
              <form action={walkAwayAction} className="mt-4 border-t border-slate-100 pt-4"><input type="hidden" name="id" value={n.id} /><button className="btn-danger w-full" type="submit">Walk away (no fee)</button></form>
            )}
          </Card>
          {n.simulated && <DemoNote>Replies from this counterparty are generated by DealPilot&apos;s simulator. No real company has been contacted.</DemoNote>}
        </div>
      </div>
    </>
  );
}
