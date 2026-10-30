import type { Metadata } from "next";
import Link from "next/link";
import { EmptySaved, GuestSaved, ImportGuestSaves } from "@/components/discovery/guest-saved";
import { SavedItem } from "@/components/discovery/saved-item";
import { PageHeader } from "@/components/ui";
import { LISTING_COLUMNS, type Kind, type Listing } from "@/lib/discovery/types";
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
  if (ctx) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("saved_properties")
      .select(`created_at, listing:listings!inner(${LISTING_COLUMNS})`)
      .eq("listing.kind", kind)
      .order("created_at", { ascending: false });
    listings = (data ?? []).map((r) => r.listing as unknown as Listing);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
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
          <ul className="space-y-3">
            {listings.map((l) => (
              <SavedItem key={l.id} listing={l} />
            ))}
          </ul>
        )
      ) : (
        <GuestSaved kind={kind} />
      )}
      <p className="text-xs text-slate-500">Couples Mode (shared shortlists with mutual matches) is coming next.</p>
    </div>
  );
}
