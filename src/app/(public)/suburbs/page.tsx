import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { STATE_INFO, type State } from "@/lib/jurisdictions";
import { createClient } from "@/lib/supabase/server";
import { listSuburbs, suburbHref } from "@/lib/suburbs/load";

export const metadata: Metadata = { title: "Suburb profiles" };

export default async function SuburbsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!FLAGS.discovery) notFound();
  const { q } = await searchParams;
  const suburbs = await listSuburbs(await createClient());
  const label = (s: { suburb: string; state: string; postcode: string }) => `${s.suburb} ${s.state} ${s.postcode}`;
  if (q) {
    const needle = q.trim().toLowerCase();
    const hit = suburbs.find((s) => label(s).toLowerCase() === needle) ?? suburbs.find((s) => s.suburb.toLowerCase() === needle || s.postcode === needle);
    if (hit) redirect(suburbHref(hit.state, hit.suburb, hit.postcode));
  }
  const byState = new Map<string, typeof suburbs>();
  for (const s of suburbs) byState.set(s.state, [...(byState.get(s.state) ?? []), s]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Suburb profiles" description="Median prices, 12-month change, long-term growth, rents and sales for houses and units." />
      <form method="get" action="/suburbs" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Suburb or postcode
        </label>
        <input id="q" name="q" list="suburb-list" defaultValue={q ?? ""} placeholder="Suburb or postcode" autoComplete="off" className="block min-h-12 flex-1 rounded-2xl border border-sand-300 bg-white px-4 text-base" />
        <datalist id="suburb-list">
          {suburbs.map((s) => (
            <option key={label(s)} value={label(s)} />
          ))}
        </datalist>
        <button type="submit" className="flex min-h-12 items-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
          <Search aria-hidden="true" className="h-5 w-5" /> Go
        </button>
      </form>
      {q ? <p className="text-sm text-slate-600">No suburb profile for &ldquo;{q}&rdquo; yet. Pick one from the list below.</p> : null}
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">These profiles currently use DEMO figures for the demo towns. Real NSW figures come next.</p>
      {[...byState].map(([st, list]) => (
        <section key={st} aria-labelledby={`st-${st}`}>
          <h2 id={`st-${st}`} className="font-display text-lg font-bold">
            {STATE_INFO[st as State].name}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {list.map((s) => (
              <li key={label(s)}>
                <Link href={suburbHref(s.state, s.suburb, s.postcode)} className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-sand-100">
                  {s.suburb}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
