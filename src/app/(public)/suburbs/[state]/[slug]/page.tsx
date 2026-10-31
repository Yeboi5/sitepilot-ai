import { ArrowLeft, Info, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypeGuide } from "@/components/suburbs/type-guide";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { STATE_INFO, type State } from "@/lib/jurisdictions";
import { createClient } from "@/lib/supabase/server";
import { loadSuburbProfile, suburbHref } from "@/lib/suburbs/load";
import { marketSummary, SUBURB_STATS_VERSION } from "@/lib/suburbs/stats";

export async function generateMetadata({ params }: { params: Promise<{ state: string; slug: string }> }): Promise<Metadata> {
  const { slug, state } = await params;
  return { title: `${slug.replace(/-\d{4}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ${state.toUpperCase()} suburb profile` };
}

/** Suburb profile (INTELLIGENCE_UPGRADE_PLAN.md §7): public, every figure with its sales count and source. */
export default async function SuburbPage({ params }: { params: Promise<{ state: string; slug: string }> }) {
  if (!FLAGS.discovery) notFound();
  const { state, slug } = await params;
  const profile = await loadSuburbProfile(await createClient(), state, slug);
  if (!profile) notFound();
  const { suburb, postcode, profiles, source } = profile;
  const st = profile.state as State;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/suburbs" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700 underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> All suburbs
      </Link>
      <header className="space-y-2">
        <p className="flex items-center gap-1 text-sm font-semibold text-slate-600">
          <MapPin aria-hidden="true" className="h-4 w-4" /> {STATE_INFO[st].name} {postcode}
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{suburb} suburb profile</h1>
        <p className="text-slate-700">Sale prices, growth, rents and demand for houses and units. Every figure shows how many sales it&apos;s based on.</p>
      </header>

      {source.isDemo ? (
        <p role="note" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <strong>DEMO figures.</strong> These are fictional statistics for testing SitePilot, not real market data for {suburb}. Real NSW figures will come from the
          NSW Valuer General&apos;s sales records and the NSW Rent and Sales Report once connected.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/discover/home?area=${encodeURIComponent(suburb)}`} className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
          Homes in {suburb}
        </Link>
        <Link href={`/discover/investment?area=${encodeURIComponent(suburb)}`} className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-4 font-semibold hover:bg-sand-100">
          Investments in {suburb}
        </Link>
      </div>

      <TypeGuide p={profiles.house} demo={source.isDemo} />
      <TypeGuide p={profiles.unit} demo={source.isDemo} />

      <section aria-labelledby="summary" className="rounded-3xl border border-sand-200 bg-white p-5">
        <h2 id="summary" className="font-display text-xl font-bold">
          {suburb} property market
        </h2>
        <p className="mt-2 leading-relaxed text-slate-700">{marketSummary(suburb, [profiles.house, profiles.unit])}</p>
      </section>

      <section aria-labelledby="area" className="rounded-3xl border border-sand-200 bg-white p-5">
        <h2 id="area" className="font-display text-xl font-bold">
          The local area
        </h2>
        <p className="mt-2 text-sm text-slate-600">A suburb map, boundaries and nearby schools will appear here once a map provider and school data are connected.</p>
        {profile.others.length ? (
          <>
            <h3 className="mt-4 font-semibold">Other suburbs in {STATE_INFO[st].name}</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {profile.others.map((o) => (
                <li key={`${o.suburb}-${o.postcode}`}>
                  <Link href={suburbHref(st, o.suburb, o.postcode)} className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-sand-100">
                    {o.suburb}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section aria-labelledby="method" className="rounded-3xl bg-sand-100 p-5 text-sm text-slate-700">
        <h2 id="method" className="flex items-center gap-1 font-display text-lg font-bold">
          <Info aria-hidden="true" className="h-4 w-4" /> Sources and method
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Source: {source.name}
            {source.url ? (
              <>
                {" "}
                (<a href={source.url} className="underline" rel="noopener noreferrer" target="_blank">
                  link
                </a>
                )
              </>
            ) : null}
            , retrieved {formatDate(source.retrievedAt)}. Status: {source.status}.
          </li>
          <li>Medians are the middle sale price over a rolling 12 months. The 12-month change compares this window with the one a year earlier.</li>
          <li>Growth per year is the compound rate between two 12-month medians. It&apos;s historical and doesn&apos;t predict future growth.</li>
          <li>Figures are never hidden for small samples: each shows how many sales it rests on, and a few unusual sales can move a small sample a lot.</li>
          <li>Gross yield = median weekly rent × 52 ÷ median sale price. Listings, days on market and buyer interest need a listings data partner.</li>
          <li>Method version {SUBURB_STATS_VERSION}.</li>
        </ul>
      </section>
    </div>
  );
}
