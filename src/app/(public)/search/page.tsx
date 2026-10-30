import { ExternalLink, Home, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoTag } from "@/components/discovery/listing-card";
import { PageHeader } from "@/components/ui";
import { portalLinks } from "@/lib/address/links";
import { demoAddressProvider } from "@/lib/address/search";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search any address" };

/** Search Any Address (v2.0 §4). Demo address data until the national address file is loaded. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const provider = demoAddressProvider(await createClient());
  const results = q ? await provider.search(q) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Search any address" description="Find a property anywhere in Australia, then make it yours or analyse it." />
      <form method="get" action="/search" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Address, suburb or postcode
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Address, suburb or postcode"
          autoComplete="street-address"
          className="block min-h-12 w-full rounded-2xl border border-sand-300 bg-white px-4 text-base shadow-sm"
        />
        <button type="submit" className="flex min-h-12 items-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
          <Search aria-hidden="true" className="h-5 w-5" />
          <span className="hidden sm:inline">Search</span>
          <span className="sr-only sm:hidden">Search</span>
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Searching {provider.name}. Australia-wide address data (the national address file) is coming; until then, if you
        can&apos;t find a property, enter it yourself.
      </p>

      {q ? (
        results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-6 text-center text-sm text-slate-600">
            No matches for &ldquo;{q}&rdquo;.
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Search results">
            {results.map((r) => {
              const address = r.streetAddress ?? `${r.suburb} (street not shown)`;
              const analyse = new URLSearchParams({
                ...(r.streetAddress ? { address: r.streetAddress } : {}),
                suburb: r.suburb,
                state: r.state,
                postcode: r.postcode,
              });
              return (
                <li key={r.recordId} className="space-y-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{address}</p>
                    {r.isDemo ? <DemoTag /> : null}
                  </div>
                  <p className="text-sm text-slate-600">
                    {r.suburb} {r.state} {r.postcode}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/my-property/new?record=${r.recordId}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-leaf-600 px-3 text-sm font-semibold text-white hover:bg-leaf-700"
                    >
                      <Home aria-hidden="true" className="h-4 w-4" /> This is my home
                    </Link>
                    <Link
                      href={`/analyse?${analyse.toString()}`}
                      className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 px-3 text-sm font-semibold hover:bg-sand-100"
                    >
                      Analyse
                    </Link>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>Listings in {r.suburb}:</span>
                    {portalLinks(r.suburb, r.state, r.postcode).map((l) => (
                      <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline">
                        {l.name} <ExternalLink aria-hidden="true" className="h-3 w-3" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ))}
                  </p>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/my-property/new" className="font-semibold text-brand-700 underline">
          Add my home manually
        </Link>
        <Link href="/analyse" className="font-semibold text-brand-700 underline">
          Analyse an address manually
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        Links to Domain and realestate.com.au open their websites. SitePilot doesn&apos;t copy listing data from other sites.
      </p>
    </div>
  );
}
