import Link from "next/link";
import { Badge, Card, Flash, Money, PageHeader, Provenance } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { parseMoney } from "@/lib/domain/money";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { compareEnergy, PRICING_SOURCES } from "@/lib/services/pricing";
import { compareEnergyAction } from "../../actions/customer";

export const metadata = { title: "Energy plan comparison" };
export const dynamic = "force-dynamic";

const source = PRICING_SOURCES.find((s) => s.id === "cdr-energy-made-easy")!;

export default async function Energy({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const postcode = f.get("postcode") ?? "";
  const dailyKwh = Number(f.get("dailyKwh") ?? "");
  const currentAnnual = parseMoney(f.get("current") ?? "") ?? undefined;
  let result: Awaited<ReturnType<typeof compareEnergy>> | undefined;
  let error = f.error;
  if (postcode && dailyKwh) {
    try {
      result = await compareEnergy(await appCtx(), actor, { postcode, dailyKwh, currentAnnualCents: currentAnnual });
    } catch (e) {
      error = e instanceof Error ? e.message : "Comparison failed";
    }
  }
  return (
    <>
      <PageHeader title="Electricity plan comparison" subtitle={<span className="flex flex-wrap items-center gap-2">Real retailer plans published by the Australian Energy Regulator <Provenance kind="live">Live government data</Provenance></span>} />
      <Flash error={error} />
      <Card>
        <form action={compareEnergyAction} className="grid gap-3 sm:grid-cols-4">
          <div><label className="label" htmlFor="postcode">Postcode</label><input className="input" id="postcode" name="postcode" inputMode="numeric" maxLength={4} defaultValue={postcode} required /></div>
          <div><label className="label" htmlFor="dailyKwh">Average daily usage (kWh)</label><input className="input" id="dailyKwh" name="dailyKwh" inputMode="decimal" defaultValue={f.get("dailyKwh") ?? ""} placeholder="e.g. 12" required /></div>
          <div><label className="label" htmlFor="current">What you pay per year (optional)</label><input className="input" id="current" name="current" inputMode="decimal" defaultValue={f.get("current") ?? ""} placeholder="e.g. 2100" /></div>
          <div className="flex items-end"><button className="btn-primary w-full" type="submit">Compare plans</button></div>
        </form>
        <p className="mt-2 text-xs text-slate-500">Your average daily usage is printed on your electricity bill. Your postcode and usage are sent nowhere except to look up public plan data.</p>
      </Card>

      {result && (
        <Card className="mt-4" title={`${result.plans.length} single-rate plans costed for ${postcode}`} action={<span className="text-xs text-slate-500">Retrieved {new Date(result.retrievedAt).toLocaleString("en-AU")}</span>}>
          {result.notCosted > 0 && <p className="mb-2 text-xs text-slate-500">{result.notCosted} other plans (time-of-use, demand or seasonal tariffs) aren&apos;t costed by this estimator yet.</p>}
          {result.brandsFailed.length > 0 && <p className="mb-2 text-xs text-amber-800">Couldn&apos;t reach: {result.brandsFailed.join(", ")}. Those retailers are missing, not cheaper or dearer.</p>}
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="table-cell">Retailer & plan</th><th className="table-cell">Supply</th><th className="table-cell">Usage</th><th className="table-cell">Est. per year</th>{currentAnnual && <th className="table-cell">vs. you</th>}<th className="table-cell" /></tr></thead>
              <tbody>
                {result.plans.slice(0, 25).map((p) => {
                  const diff = currentAnnual ? currentAnnual - p.estimatedAnnualCents : undefined;
                  return (
                    <tr key={p.planId} className="border-b border-slate-100">
                      <td className="table-cell"><p className="font-medium">{p.brandName} — {p.displayName}</p>
                        <p className="text-xs text-slate-500">{p.type === "STANDING" ? "Standing offer" : "Market offer"} · {p.distributors.join(", ")} · {p.planId}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.eligibility.map((e) => <Badge key={e} tone="amber">Eligibility: {e}</Badge>)}
                          {p.hasConditionalDiscounts && <Badge tone="blue">Has discounts (not included)</Badge>}
                          {p.hasControlledLoad && <Badge>Controlled-load tariff not included</Badge>}
                        </div>
                      </td>
                      <td className="table-cell whitespace-nowrap">{p.dailySupplyCents.toFixed(2)}c/day</td>
                      <td className="table-cell whitespace-nowrap">{p.firstRateCentsPerKwh.toFixed(2)}c/kWh</td>
                      <td className="table-cell font-semibold"><Money cents={p.estimatedAnnualCents} /></td>
                      {currentAnnual && <td className={`table-cell ${diff! > 0 ? "text-brand-700" : "text-slate-500"}`}>{diff! > 0 ? <>save ~<Money cents={diff!} /></> : "—"}</td>}
                      <td className="table-cell"><Link className="text-xs text-brand-700 underline" href={`/app/negotiations/new?category=energy&baseline=${currentAnnual ? (currentAnnual / 1200).toFixed(2) : ""}&recurrence=monthly&target=${(p.estimatedAnnualCents / 1200).toFixed(2)}`}>Use as negotiation lever</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {source.attribution} Estimates by DealPilot from published single-rate tariffs, including GST, excluding conditional discounts, solar feed-in and controlled load. Check the full plan on energymadeeasy.gov.au before switching. This is general information, not a quote or advice.
          </p>
        </Card>
      )}
    </>
  );
}
