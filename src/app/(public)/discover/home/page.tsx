import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { FLAGS } from "@/lib/flags";

export const metadata: Metadata = { title: "Find My Home" };

export default function DiscoverHomePage() {
  if (!FLAGS.discovery) notFound();
  return (
    <ComingSoon title="Find My Home" points={["For Sale and Off-Market Potential tabs","Lifestyle filters: schools, transport, parks and more","Couples Mode: separate preferences, a shared shortlist of mutual matches"]}>
      <p>Large photos (once licensed), price, suburb, bedrooms and bathrooms, lifestyle filters and shortlists. Swipe right to save, left to pass, or use the Save and Pass buttons.</p>
      <p className="mt-2 text-sm text-slate-600">Demo listings arrive in the next update. All listings will be marked DEMO until we have licensed data.</p>
    </ComingSoon>
  );
}
