import { CategorySelect } from "@/components/category-select";
import { Badge, Card, Empty, Flash, Money, PageHeader, Provenance, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { currentPrice } from "@/lib/domain/monitoring";
import type { WatchKind } from "@/lib/domain/types";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listAlerts, listWatches } from "@/lib/services/monitoring";
import { addPriceAction, claimAdjustmentAction, createWatchAction, removeWatchAction, simulateFeedAction } from "../../actions/customer";

export const metadata = { title: "Price monitor" };

const KIND: Record<WatchKind, string> = { retail_product: "Retail purchase", bill: "Recurring bill", subscription: "Subscription", contract: "Contract" };

export default async function Monitor({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const ctx = await appCtx();
  const [watches, alerts] = await Promise.all([listWatches(ctx, actor), listAlerts(ctx, actor)]);
  return (
    <>
      <PageHeader title="Price monitor" subtitle="Purchases, bills, subscriptions and contracts — with alerts when you can save." />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {watches.length === 0 && <Empty title="Nothing monitored yet" />}
          {watches.map((w) => {
            const price = currentPrice(w);
            const diff = price - w.purchasePriceCents;
            const wAlerts = alerts.filter((a) => a.watchId === w.id);
            return (
              <section key={w.id} id={w.id} className="card scroll-mt-24">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{w.label}</p>
                    <p className="text-xs text-slate-500">{KIND[w.kind]} · {w.merchant}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold"><Money cents={price} /></p>
                    {diff !== 0 && <p className={diff < 0 ? "text-xs text-brand-700" : "text-xs text-red-700"}>{diff < 0 ? "▼" : "▲"} <Money cents={Math.abs(diff)} /> vs {w.kind === "retail_product" ? "what you paid" : "start"}</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {w.dataSource === "simulated_feed" ? <Provenance kind="simulated">Simulated price feed</Provenance> : w.dataSource === "approved_api" ? <Provenance kind="live">Approved API</Provenance> : <Badge>Manual entry</Badge>}
                  {w.targetPriceCents !== undefined && <Badge tone="blue">Target <Money cents={w.targetPriceCents} /></Badge>}
                  {w.adjustmentWindowDays && w.purchasedAt && <Badge>Bought {relTime(w.purchasedAt)} · {w.adjustmentWindowDays}-day adjustment window</Badge>}
                  {w.renewalDate && <Badge tone="amber">Renews {relTime(w.renewalDate)}</Badge>}
                </div>
                {w.history.length > 1 && (
                  <ol className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {w.history.map((h, i) => <li key={i} className="rounded bg-slate-50 px-2 py-1"><Money cents={h.cents} /> · {new Date(h.at).toLocaleDateString("en-AU")} · {h.source.replace("_", " ")}</li>)}
                  </ol>
                )}
                {wAlerts.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {wAlerts.map((a) => <li key={a.id} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>{a.title}.</strong> {a.body}</li>)}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <form action={simulateFeedAction}><input type="hidden" name="id" value={w.id} /><button className="btn-secondary px-3 py-1.5" type="submit">Simulate feed update</button></form>
                  <form action={addPriceAction} className="flex gap-2"><input type="hidden" name="id" value={w.id} /><input className="input w-28 py-1.5" name="price" inputMode="decimal" placeholder="New price" required /><button className="btn-secondary px-3 py-1.5" type="submit">Record</button></form>
                  {w.kind === "retail_product" && diff < 0 && <form action={claimAdjustmentAction}><input type="hidden" name="id" value={w.id} /><button className="btn-primary px-3 py-1.5" type="submit">Claim price adjustment</button></form>}
                  {(w.kind === "bill" || w.kind === "subscription" || w.kind === "contract") && <a className="btn-primary px-3 py-1.5" href={`/app/negotiations/new?category=${w.categoryId}&baseline=${(price / 100).toFixed(2)}&recurrence=${w.kind === "contract" ? "annual" : "monthly"}`}>Negotiate</a>}
                  <form action={removeWatchAction} className="ml-auto"><input type="hidden" name="id" value={w.id} /><button className="text-xs text-slate-500 underline" type="submit">Stop monitoring</button></form>
                </div>
              </section>
            );
          })}
        </div>
        <div className="space-y-4">
          <Card title="Track something new">
            <form action={createWatchAction} className="space-y-3">
              <div><label className="label" htmlFor="kind">Type</label><select className="input" id="kind" name="kind">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label" htmlFor="label">What is it?</label><input className="input" id="label" name="label" required /></div>
              <div><label className="label" htmlFor="merchant">Retailer / provider</label><input className="input" id="merchant" name="merchant" required /></div>
              <div><label className="label" htmlFor="categoryId">Category</label><CategorySelect defaultValue="retail" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label" htmlFor="price">Price paid</label><input className="input" id="price" name="price" inputMode="decimal" required /></div>
                <div><label className="label" htmlFor="target">Target</label><input className="input" id="target" name="target" inputMode="decimal" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label" htmlFor="window">Adjustment window (days)</label><input className="input" id="window" name="window" inputMode="numeric" /></div>
                <div><label className="label" htmlFor="renewalDate">Renewal / expiry</label><input className="input" id="renewalDate" name="renewalDate" type="date" /></div>
              </div>
              <button className="btn-primary w-full" type="submit">Start monitoring</button>
            </form>
          </Card>
          <p className="text-xs text-slate-500">DealPilot only uses prices you enter, approved retailer APIs, or (in this prototype) a clearly labelled simulated feed. It never scrapes websites. Price-adjustment policies vary — always confirm with the retailer.</p>
        </div>
      </div>
    </>
  );
}
