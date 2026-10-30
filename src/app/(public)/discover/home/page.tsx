import type { Metadata } from "next";
import { DeckPage, type DeckSearchParams } from "@/components/discovery/deck-page";

export const metadata: Metadata = { title: "Find My Home" };

export default async function DiscoverHomePage({ searchParams }: { searchParams: Promise<DeckSearchParams> }) {
  return <DeckPage kind="home" searchParams={await searchParams} />;
}
