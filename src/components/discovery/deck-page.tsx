import { EyeOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SwipeDeck } from "@/components/discovery/swipe-deck";
import { FLAGS } from "@/lib/flags";
import { LISTING_COLUMNS, MARKET_LABEL, type Kind, type Market } from "@/lib/discovery/types";
import { STATES, STATE_INFO, isState } from "@/lib/jurisdictions";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Params = { market?: string; state?: string; beds?: string };

const COPY: Record<Kind, { title: string; intro: string; accent: string }> = {
  home: { title: "Find My Home", intro: "Homes that fit your life. Swipe right to save, left to pass.", accent: "text-brand-700" },
  investment: {
    title: "Find My Investment",
    intro: "Opportunities with labelled numbers. Every estimate shows its assumptions.",
    accent: "text-leaf-700",
  },
};

/** Shared page for both discovery journeys (v2.0 §3). Guests can use it without an account. */
export async function DeckPage({ kind, searchParams }: { kind: Kind; searchParams: Params }) {
  if (!FLAGS.discovery) notFound();
  const market: Market = searchParams.market === "off_market" ? "off_market" : "for_sale";
  const state = isState(searchParams.state) ? searchParams.state : null;
  const beds = kind === "home" ? Math.max(0, Math.min(6, Number(searchParams.beds) || 0)) : 0;

  const ctx = await getSessionContext();
  const supabase = await createClient();
  let query = supabase.from("listings").select(LISTING_COLUMNS).eq("kind", kind).eq("market", market).order("listed_on", { ascending: false, nullsFirst: false }).order("id");
  if (state) query = query.eq("state", state);
  if (beds) query = query.gte("bedrooms", beds);
  const { data: listings } = await query.limit(100);

  // Signed-in users: hide listings already saved or passed (latest decision wins).
  let decidedIds: string[] = [];
  if (ctx && listings?.length) {
    const { data: events } = await supabase
      .from("swipe_events")
      .select("listing_id, action")
      .in("listing_id", listings.map((l) => l.id))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    const latest = new Map<string, string>();
    for (const e of events ?? []) if (!latest.has(e.listing_id)) latest.set(e.listing_id, e.action);
    decidedIds = [...latest].filter(([, a]) => a === "save" || a === "pass").map(([id]) => id);
  }

  const copy = COPY[kind];
  const base = `/discover/${kind}`;
  const tabHref = (m: Market) => {
    const p = new URLSearchParams();
    if (m === "off_market") p.set("market", m);
    if (state) p.set("state", state);
    if (beds) p.set("beds", String(beds));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      <header className="text-center">
        <h1 className={`text-2xl font-extrabold tracking-tight sm:text-3xl ${copy.accent}`}>{copy.title}</h1>
        <p className="mt-1 text-sm text-slate-700 sm:text-base">{copy.intro}</p>
      </header>

      <nav aria-label="Listing type" className="mx-auto flex max-w-md rounded-2xl bg-sand-100 p-1">
        {(["for_sale", "off_market"] as const).map((m) => (
          <Link
            key={m}
            href={tabHref(m)}
            aria-current={market === m ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${
              market === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {MARKET_LABEL[m]}
          </Link>
        ))}
      </nav>

      {/* Collapsed by default so the first card is visible quickly on phones. */}
      <details className="mx-auto max-w-md rounded-2xl border border-sand-200 bg-white px-4 py-2" open={Boolean(state || beds) || undefined}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold text-slate-800">
          <span>Filters</span>
          <span className="font-normal text-slate-600">
            {state ? STATE_INFO[state].name : "All of Australia"}{beds ? ` · ${beds}+ bed` : ""}
          </span>
        </summary>
      <form method="get" action={base} className="flex flex-wrap items-end gap-2 pb-2">
        {market === "off_market" ? <input type="hidden" name="market" value="off_market" /> : null}
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="state" className="block text-xs font-medium text-slate-700">
            State or territory
          </label>
          <select id="state" name="state" defaultValue={state ?? ""} className="mt-1 block min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-base sm:text-sm">
            <option value="">All of Australia</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {STATE_INFO[s].name}
              </option>
            ))}
          </select>
        </div>
        {kind === "home" ? (
          <div className="w-28">
            <label htmlFor="beds" className="block text-xs font-medium text-slate-700">
              Bedrooms
            </label>
            <select id="beds" name="beds" defaultValue={beds ? String(beds) : ""} className="mt-1 block min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-base sm:text-sm">
              <option value="">Any</option>
              {[1, 2, 3, 4].map((b) => (
                <option key={b} value={b}>
                  {b}+
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button type="submit" className="min-h-11 rounded-xl border border-sand-300 bg-white px-4 text-sm font-semibold hover:bg-sand-100">
          Apply
        </button>
      </form>
      </details>

      {market === "off_market" ? (
        <div role="note" className="mx-auto flex max-w-md gap-3 rounded-2xl bg-slate-900 p-3 text-xs text-white sm:p-4 sm:text-sm">
          <EyeOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>NOT FOR SALE.</strong> Off-market potential shows properties that are not listed for sale, to help you
            spot possibilities. It&apos;s speculative: owners haven&apos;t indicated they want to sell, and we never show
            street addresses or owner details.
          </p>
        </div>
      ) : null}

      <p className="mx-auto max-w-md text-center text-xs font-medium text-amber-900">
        DEMO listings with illustrative prices, until we have licensed listing data.
      </p>

      {(listings ?? []).length === 0 ? (
        <p className="mx-auto max-w-md rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center text-slate-600">
          No listings match. Try another state or fewer bedrooms.
        </p>
      ) : (
        // Re-mount the deck when the filters change so it starts fresh.
        <SwipeDeck key={`${kind}-${market}-${state}-${beds}`} listings={listings ?? []} signedIn={Boolean(ctx)} decidedIds={decidedIds} />
      )}
    </div>
  );
}
