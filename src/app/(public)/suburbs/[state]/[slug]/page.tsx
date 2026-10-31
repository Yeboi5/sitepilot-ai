import { ArrowLeft, Info, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfficialGuide } from "@/components/suburbs/official-guide";
import { TypeGuide } from "@/components/suburbs/type-guide";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { STATE_INFO, type State } from "@/lib/jurisdictions";
import { DCJ_LICENCE, DCJ_SOURCE_PAGE } from "@/lib/official/dcj";
import { officialSummary } from "@/lib/official/postcode";
import { createClient } from "@/lib/supabase/server";
import { loadOfficialPostcode, loadSuburbProfile, suburbHref } from "@/lib/suburbs/load";
import { marketSummary, SUBURB_STATS_VERSION } from "@/lib/suburbs/stats";

const titleFrom = (slug: string) =>
  slug.startsWith("postcode-") ? `Postcode ${slug.slice(9)}` : slug.replace(/-\d{4}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function generateMetadata({ params }: { params: Promise<{ state: string; slug: string }> }): Promise<Metadata> {
  const { slug, state } = await params;
  return { title: `${titleFrom(slug)} ${state.toUpperCase()} suburb profile` };
}

/**
 * Suburb profile (INTELLIGENCE_UPGRADE_PLAN.md §7). Official NSW figures (NSW Rent and Sales Report,
 * by postcode) are shown when loaded; otherwise suburb statistics (DEMO for the demo towns).
 * `/suburbs/nsw/postcode-2259` shows a postcode without a named suburb page.
 */
export default async function SuburbPage({ params }: { params: Promise<{ state: string; slug: string }> }) {
  if (!FLAGS.discovery) notFound();
  const { state, slug } = await params;
  const st = state.toUpperCase();
  const postcode = /(\d{4})$/.exec(slug)?.[1];
  if (!postcode || !(st in STATE_INFO)) notFound();
  const supabase = await createClient();
  const [profile, official] = await Promise.all([
    slug.startsWith("postcode-") ? Promise.resolve(null) : loadSuburbProfile(supabase, state, slug),
    loadOfficialPostcode(supabase, st, postcode),
  ]);
  if (!profile && !official) notFound();
  const name = profile?.suburb ?? `Postcode ${postcode}`;
  const where = profile?.suburb ?? `postcode ${postcode}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/suburbs" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700 underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> All suburbs
      </Link>
      <header className="space-y-2">
        <p className="flex items-center gap-1 text-sm font-semibold text-slate-600">
          <MapPin aria-hidden="true" className="h-4 w-4" /> {STATE_INFO[st as State].name} {postcode}
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{name} suburb profile</h1>
        <p className="text-slate-700">Sale prices, growth and rents for houses and units, with the number of sales behind every figure.</p>
      </header>

      {official ? (
        <p role="note" className="rounded-2xl bg-leaf-50 p-4 text-sm text-leaf-900">
          <strong>Official NSW figures</strong> for postcode {postcode}
          {profile ? `, which covers ${profile.suburb} and nearby suburbs` : ""}, from the NSW Rent and Sales Report (Department of Communities and Justice). Quarterly
          figures, as published.
        </p>
      ) : profile?.source.isDemo ? (
        <p role="note" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <strong>DEMO figures.</strong> These are fictional statistics for testing SitePilot, not real market data for {profile.suburb}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/discover/home?area=${encodeURIComponent(profile?.suburb ?? postcode)}`} className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
          Homes in {where}
        </Link>
        <Link href={`/discover/investment?area=${encodeURIComponent(profile?.suburb ?? postcode)}`} className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-4 font-semibold hover:bg-sand-100">
          Investments in {where}
        </Link>
      </div>

      {official ? (
        <>
          <OfficialGuide t={official.house} postcode={postcode} />
          <OfficialGuide t={official.unit} postcode={postcode} />
        </>
      ) : profile ? (
        <>
          <TypeGuide p={profile.profiles.house} demo={profile.source.isDemo} />
          <TypeGuide p={profile.profiles.unit} demo={profile.source.isDemo} />
        </>
      ) : null}

      <section aria-labelledby="summary" className="rounded-3xl border border-sand-200 bg-white p-5">
        <h2 id="summary" className="font-display text-xl font-bold">
          {name} property market
        </h2>
        <p className="mt-2 leading-relaxed text-slate-700">{official ? officialSummary(official) : marketSummary(profile!.suburb, [profile!.profiles.house, profile!.profiles.unit])}</p>
      </section>

      <section aria-labelledby="area" className="rounded-3xl border border-sand-200 bg-white p-5">
        <h2 id="area" className="font-display text-xl font-bold">
          The local area
        </h2>
        <p className="mt-2 text-sm text-slate-600">A suburb map, boundaries and nearby schools will appear here once a map provider and school data are connected.</p>
        {profile?.others.length ? (
          <>
            <h3 className="mt-4 font-semibold">Other suburbs in {STATE_INFO[st as State].name}</h3>
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
        {official ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Source: NSW Rent and Sales Report, {DCJ_LICENCE} (
              <a href="https://creativecommons.org/licenses/by/4.0/" className="underline" rel="noopener noreferrer" target="_blank">
                licence
              </a>
              ,{" "}
              <a href={DCJ_SOURCE_PAGE} className="underline" rel="noopener noreferrer" target="_blank">
                report
              </a>
              ,{" "}
              <a href="https://dcj.nsw.gov.au/statements/copyright-and-disclaimer.html" className="underline" rel="noopener noreferrer" target="_blank">
                copyright notice
              </a>
              ). Retrieved {official.retrievedAt ? formatDate(official.retrievedAt) : "recently"}.
            </li>
            <li>
              SitePilot has reformatted DCJ&apos;s postcode tables, converted prices from $&apos;000 to dollars, and calculated the 3- and 5-year growth and gross yield. It is
              not endorsed by the NSW Government.
            </li>
            <li>Figures are for the whole postcode, which can include several suburbs. Sales are by settlement quarter; rents are for new bonds lodged.</li>
            <li>DCJ doesn&apos;t publish a median when 10 or fewer properties sold, and shows &ldquo;30 or fewer&rdquo; instead of exact small counts. We show exactly what was published.</li>
            <li>Growth is historical and doesn&apos;t predict future growth.</li>
          </ul>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Source: {profile!.source.name}, retrieved {formatDate(profile!.source.retrievedAt)}. Status: {profile!.source.status}.
            </li>
            <li>Medians are the middle sale price over a rolling 12 months; growth per year is the compound rate between two 12-month medians.</li>
            <li>Figures are never hidden for small samples: each shows how many sales it rests on.</li>
            <li>Method version {SUBURB_STATS_VERSION}.</li>
          </ul>
        )}
      </section>
    </div>
  );
}
