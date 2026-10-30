import type { Metadata } from "next";
import Link from "next/link";
import { EmptySaved, GuestSaved, ImportGuestSaves } from "@/components/discovery/guest-saved";
import { SavedList } from "@/components/discovery/saved-list";
import { PageHeader } from "@/components/ui";
import { LISTING_COLUMNS, type Kind, type Listing } from "@/lib/discovery/types";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved properties" };

const TABS: { kind: Kind; label: string }[] = [
  { kind: "home", label: "Homes" },
  { kind: "investment", label: "Investments" },
];

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const kind: Kind = k === "investment" ? "investment" : "home";
  const ctx = await getSessionContext();

  let listings: Listing[] = [];
  let comparisons: { id: string; name: string; updated_at: string }[] = [];
  if (ctx) {
    const supabase = await createClient();
    const [{ data }, { data: sets }] = await Promise.all([
      supabase
        .from("saved_properties")
        .select(`created_at, listing:listings!inner(${LISTING_COLUMNS})`)
        .eq("listing.kind", kind)
        .order("created_at", { ascending: false }),
      FLAGS.compare ? supabase.from("comparison_sets").select("id, name, updated_at").order("updated_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ]);
    listings = (data ?? []).map((r) => r.listing as unknown as Listing);
    comparisons = sets ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Saved properties" description={ctx ? "Synced to your account." : "Kept on this device. Create an account to sync."} />
      {ctx ? <ImportGuestSaves /> : null}
      <nav aria-label="Saved lists" className="flex rounded-2xl bg-sand-100 p-1">
        {TABS.map((t) => (
          <Link
            key={t.kind}
            href={t.kind === "home" ? "/saved" : "/saved?kind=investment"}
            aria-current={kind === t.kind ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold ${
              kind === t.kind ? "bg-white shadow-sm" : "text-slate-600"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {ctx ? (
        listings.length === 0 ? (
          <EmptySaved kind={kind} />
        ) : (
          <SavedList listings={listings} />
        )
      ) : (
        <GuestSaved kind={kind} />
      )}
      {comparisons.length ? (
        <section aria-labelledby="comparisons-heading" className="space-y-2">
          <h2 id="comparisons-heading" className="font-display text-lg font-bold">
            Your comparisons
          </h2>
          <ul className="divide-y divide-sand-100 rounded-2xl border border-sand-200 bg-white">
            {comparisons.map((c) => (
              <li key={c.id}>
                <Link href={`/compare/${c.id}`} className="flex min-h-11 items-center justify-between gap-2 px-4 py-2 text-sm hover:bg-sand-50">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-slate-500">{formatDate(c.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-slate-500">Couples Mode (shared shortlists with mutual matches) is coming next.</p>
    </div>
  );
}
