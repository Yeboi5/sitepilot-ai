import type { Metadata } from "next";
import { PropertyForm } from "@/app/(app)/investor/properties/new/property-form";
import { Card, PageHeader } from "@/components/ui";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Analyse a property" };

/** "Search address" entry point (Update Pack 1.1). Manual entry only; no live data lookups. */
export default async function AnalysePage() {
  await requireOrg("investor");
  return (
    <>
      <PageHeader
        title="Analyse a property"
        description="Enter an address to start a private workspace. You'll add official planning evidence and model scenarios there. SitePilot doesn't look up or guess planning or valuation data."
      />
      <Card className="max-w-2xl">
        <PropertyForm />
      </Card>
    </>
  );
}
