import type { Metadata } from "next";
import { PropertyForm, type PropertyDefaults } from "@/app/(app)/investor/properties/new/property-form";
import { Card, PageHeader } from "@/components/ui";
import { STATES } from "@/lib/jurisdictions";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Analyse a property" };

/** "Search address" entry point (Update Pack 1.1). Manual entry only; no live data lookups. */
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export default async function AnalysePage({ searchParams }: { searchParams: Search }) {
  await requireOrg("investor");
  // Prefill from "Search any address". Values only seed the form; the action re-validates them.
  const sp = await searchParams;
  const state = one(sp.state, 3);
  const postcode = one(sp.postcode, 4);
  const defaults: PropertyDefaults = {
    address: one(sp.address, 200),
    suburb: one(sp.suburb, 80),
    state: state && (STATES as readonly string[]).includes(state) ? state : undefined,
    postcode: postcode && /^\d{4}$/.test(postcode) ? postcode : undefined,
  };
  return (
    <>
      <PageHeader
        title="Analyse a property"
        description="Enter an address to start a private workspace. You'll add official planning evidence and model scenarios there. SitePilot doesn't look up or guess planning or valuation data."
      />
      <Card className="max-w-2xl">
        <PropertyForm defaults={defaults} />
      </Card>
    </>
  );
}
