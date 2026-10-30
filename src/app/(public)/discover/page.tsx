import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryCards } from "@/components/dashboard/entry-cards";
import { PageHeader } from "@/components/ui";
import { FLAGS } from "@/lib/flags";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  if (!FLAGS.discovery) notFound();
  return (
    <>
      <PageHeader title="Discover" description="Two ways to explore. Each has For Sale and Off-Market Potential views." />
      <EntryCards />
    </>
  );
}
