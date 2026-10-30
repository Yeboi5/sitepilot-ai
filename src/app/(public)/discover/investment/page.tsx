import type { Metadata } from "next";
import { DeckPage, type DeckSearchParams } from "@/components/discovery/deck-page";

export const metadata: Metadata = { title: "Find My Investment" };

export default async function DiscoverInvestmentPage({ searchParams }: { searchParams: Promise<DeckSearchParams> }) {
  return <DeckPage kind="investment" searchParams={await searchParams} />;
}
