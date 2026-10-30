import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareView } from "@/components/compare/compare-view";
import { PageHeader } from "@/components/ui";
import { loadCompareProperties, MIN_COMPARE, parseIds } from "@/lib/compare/load";
import { initialState } from "@/lib/compare/state";
import { FLAGS } from "@/lib/flags";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Compare properties" };

/** Compare 2–5 saved properties (Blueprint v2.1). Works for guests on DEMO data; saving needs an account. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; mode?: string }> }) {
  if (!FLAGS.compare) notFound();
  const sp = await searchParams;
  const ids = parseIds(sp.ids);
  const [ctx, supabase] = await Promise.all([getSessionContext(), createClient()]);
  const properties = await loadCompareProperties(supabase, ids);

  if (properties.length < MIN_COMPARE) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="Compare properties" description="Pick 2 to 5 properties from your saved list to compare them side by side." />
        <Link href="/saved?kind=investment" className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-white">
          Choose from Saved
        </Link>
      </div>
    );
  }
  const kinds = new Set(properties.map((p) => p.listing.kind));
  const mode = sp.mode === "homebuyer" || sp.mode === "investor" ? sp.mode : kinds.has("investment") ? "investor" : "homebuyer";

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link href={`/saved${mode === "investor" ? "?kind=investment" : ""}`} className="text-brand-700 underline">
          ← Saved properties
        </Link>
      </p>
      <PageHeader title="Compare properties" description={`${properties.length} properties side by side. Change any assumption and everything updates.`} />
      <CompareView properties={properties} initial={initialState(properties.map((p) => p.listing.id), mode)} signedIn={Boolean(ctx)} />
    </div>
  );
}
