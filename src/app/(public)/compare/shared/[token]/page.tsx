import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metric } from "@/lib/compare/engine";
import type { Snapshot } from "@/lib/compare/snapshot";
import { FLAGS } from "@/lib/flags";
import { formatAud, formatDate, formatRatio } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { hashShareToken, isShareToken } from "@/lib/vision/share";

// Secret links shouldn't be indexed or leak through the Referer header.
export const metadata: Metadata = { title: "Shared comparison", robots: { index: false, follow: false }, referrer: "no-referrer" };

const show = (m: Metric | undefined, f: (n: number) => string = formatAud) => (m?.known ? f(m.value) : "Unknown");

export default async function SharedComparisonPage({ params }: { params: Promise<{ token: string }> }) {
  if (!FLAGS.compare) notFound();
  const { token } = await params;
  if (!isShareToken(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_comparison", { token_hash: hashShareToken(token) });
  const shared = data?.[0];
  const snap = shared?.snapshot as Snapshot | undefined;
  if (!shared || snap?.version !== 1) notFound();

  const rows: [string, (p: Snapshot["properties"][number]) => string][] = [
    ["Status", (p) => (p.notForSale ? "NOT FOR SALE" : "For sale")],
    ["Location", (p) => p.location],
    ["Type", (p) => p.propertyType],
    ["Beds · baths", (p) => (p.propertyType === "land" ? "Vacant land" : `${p.bedrooms ?? "?"} · ${p.bathrooms ?? "?"}`)],
    ["Land area", (p) => (p.landAreaSqm ? `${p.landAreaSqm} m²` : "Unknown")],
    ["Price basis", (p) => p.priceLabel],
    ["Price or estimate", (p) => show(p.figures.price)],
    ["Cash required", (p) => show(p.figures.cashRequired)],
    ["Repayments (year 1)", (p) => show(p.figures.annualRepayments)],
    ["Gross yield", (p) => show(p.figures.grossYield, (n) => formatRatio(n))],
    ["Net yield", (p) => show(p.figures.netYield, (n) => formatRatio(n))],
    ["Cash flow (year 1)", (p) => show(p.figures.cashFlowYear1)],
    [`Net return, base (${snap.assumptions.holdingYears} yrs)`, (p) => show(p.projections?.base?.netReturn)],
    ["Investment Match Score", (p) => (p.score != null ? `${p.score}/100` : "Not enough evidence")],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-2xl font-extrabold">{shared.name}</h1>
      <p className="text-sm text-slate-600">
        A frozen copy shared on {formatDate(shared.shared_at)}. Figures use the sharer&apos;s assumptions: {snap.assumptions.depositPct}% deposit,{" "}
        {snap.assumptions.interestRatePct}% interest, {snap.assumptions.growthPct.base}% base growth a year.
      </p>
      {snap.properties.some((p) => p.isDemo) ? <p className="rounded-2xl bg-sand-100 p-3 text-sm">Includes DEMO properties: fictional listings and estimates.</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white" tabIndex={0} role="region" aria-label="Shared comparison table">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <td className="sticky left-0 bg-white" />
              {snap.properties.map((p) => (
                <th key={p.label} scope="col" className="min-w-[10rem] px-3 py-3 text-left align-top">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label} className="border-t border-sand-100">
                <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-slate-700">
                  {label}
                </th>
                {snap.properties.map((p) => (
                  <td key={p.label} className="px-3 py-2">
                    {f(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
        Educational only. Pre-tax figures based on assumptions, not forecasts or financial advice. Estimated values aren&apos;t prices. Development potential
        hasn&apos;t been assessed. Check with licensed professionals before deciding. Engine {snap.engine}, scoring {snap.scoring}.
      </p>
      <Link href="/discover/investment" className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">
        Explore SitePilot
      </Link>
    </div>
  );
}
