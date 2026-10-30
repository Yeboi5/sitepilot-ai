import type { Metadata } from "next";
import { DeckPage } from "@/components/discovery/deck-page";

export const metadata: Metadata = { title: "Find My Home" };

export default async function DiscoverHomePage({ searchParams }: { searchParams: Promise<{ market?: string; state?: string; beds?: string }> }) {
  return <DeckPage kind="home" searchParams={await searchParams} />;
}
