import type { Metadata } from "next";
import { DeckPage } from "@/components/discovery/deck-page";

export const metadata: Metadata = { title: "Find My Investment" };

export default async function DiscoverInvestmentPage({ searchParams }: { searchParams: Promise<{ market?: string; state?: string; beds?: string }> }) {
  return <DeckPage kind="investment" searchParams={await searchParams} />;
}
