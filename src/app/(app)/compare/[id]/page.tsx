import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CompareView } from "@/components/compare/compare-view";
import { PageHeader } from "@/components/ui";
import { loadCompareProperties, loadSavedOptions, MIN_COMPARE, parseIds } from "@/lib/compare/load";
import { loadSavedState } from "@/lib/compare/saved";
import { FLAGS } from "@/lib/flags";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved comparison", referrer: "no-referrer" };

export default async function SavedComparisonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; ids?: string }> }) {
  if (!FLAGS.compare) notFound();
  const { id } = await params;
  const { view, ids: idsParam } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireOrg();
  const saved = await loadSavedState(id);
  if (!saved) notFound();
  // ?ids= holds an edited property list that hasn't been saved yet.
  const edited = parseIds(idsParam);
  const listingIds = edited.length >= MIN_COMPARE ? edited : saved.listingIds;
  const unsavedItems = listingIds.join(",") !== saved.listingIds.join(",");
  const supabase = await createClient();
  const [properties, savedOptions] = await Promise.all([loadCompareProperties(supabase, listingIds), loadSavedOptions(supabase)]);
  const { sharedAt, ...state } = saved;
  // Drop any property that's no longer available (e.g. a listing removed since saving).
  const available = new Set(properties.map((p) => p.listing.id));
  const missing = listingIds.filter((x) => !available.has(x)).length;

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link href="/saved?kind=investment" className="text-brand-700 underline">
          ← Saved properties
        </Link>
      </p>
      <PageHeader title={state.name} description="Your saved comparison. Only you can see it unless you share a link." />
      {missing ? <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{missing} property is no longer available and has been left out.</p> : null}
      <CompareView initialView={view === "advanced" ? "advanced" : "quick"} properties={properties} initial={{ ...state, listingIds: [...available] }} setId={id} signedIn sharedAt={sharedAt} savedOptions={savedOptions} unsavedItems={unsavedItems} />
    </div>
  );
}
