import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { FLAGS } from "@/lib/flags";

export const metadata: Metadata = { title: "Find My Investment" };

export default function DiscoverInvestmentPage() {
  if (!FLAGS.discovery) notFound();
  return (
    <ComingSoon title="Find My Investment" points={["For Sale and Off-Market Potential tabs","Indicative yield and cash flow from deterministic, tested formulas","Analyse this deal: open an editable feasibility workspace"]}>
      <p>Asking price, indicative gross yield, estimated cash flow, scenario ideas and risk flags, with every estimate labelled and its assumptions shown.</p>
      <p className="mt-2 text-sm text-slate-600">Demo listings arrive in the next update. All listings will be marked DEMO until we have licensed data.</p>
    </ComingSoon>
  );
}
