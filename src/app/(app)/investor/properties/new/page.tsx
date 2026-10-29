import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireOrg } from "@/lib/session";
import { PropertyForm } from "./property-form";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  await requireOrg("investor");
  return (
    <>
      <PageHeader
        title="Add property"
        description="Enter the address as it appears on official records. Planning information is added afterwards as sourced evidence. SitePilot does not guess zoning."
      />
      <Card>
        <PropertyForm />
      </Card>
    </>
  );
}
