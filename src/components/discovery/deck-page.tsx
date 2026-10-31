import { EyeOff, MapPin, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SwipeDeck } from "@/components/discovery/swipe-deck";
import { areaFilter, parseAreas } from "@/lib/discovery/area";
import {
  activeCount,
  applyFilters,
  filterParams,
  LAND_STEPS,
  parseFilters,
  PRICE_STEPS,
  PROPERTY_TYPES,
  SORTS,
  TYPE_LABEL,
  YIELD_STEPS,
  type Filters,
} from "@/lib/discovery/filters";
import { LISTING_COLUMNS, MARKET_LABEL, type Kind, type Market } from "@/lib/discovery/types";
import { FLAGS } from "@/lib/flags";
import { formatAudCompact } from "@/lib/format";
import { STATES, STATE_INFO } from "@/lib/jurisdictions";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type DeckSearchParams = Record<string, string | string[] | undefined>;

const COPY: Record<Kind, { title: string; intro: string; accent: string }> = {
  home: { title: "Find My Home", intro: "Homes that fit your life. Swipe right to save, left to pass.", accent: "text-brand-700" },
  investment: {
    title: "Find My Investment",
    intro: "Opportunities with labelled numbers. Every estimate shows its assumptions.",
    accent: "text-leaf-700",
  },
};

const selectClass = "mt-1 block min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-base sm:text-sm";
const labelClass = "block text-xs font-medium text-slate-700";

function summary(f: Filters, market: Market) {
  const parts: string[] = [];
  if (f.state) parts.push(STATE_INFO[f.state].name);
  if (market === "for_sale" && (f.priceMin || f.priceMax))
    parts.push(f.priceMin && f.priceMax ? `${formatAudCompact(f.priceMin)}–${formatAudCompact(f.priceMax)}` : f.priceMin ? `${formatAudCompact(f.priceMin)}+` : `Up to ${formatAudCompact(f.priceMax!)}`);
  if (f.types.length) parts.push(f.types.map((t) => TYPE_LABEL[t]).join(", "));
  if (f.beds) parts.push(`${f.beds}+ bed`);
  if (f.baths) parts.push(`${f.baths}+ bath`);
  if (f.cars) parts.push(`${f.cars}+ car`);
  if (f.landMin) parts.push(`${f.landMin}+ m²`);
  if (f.yieldMin) parts.push(`${f.yieldMin}%+ yield`);
  return parts.length ? parts.join(" · ") : "All of Australia";
}

/** Shared page for both discovery journeys (v2.0 §3). Guests can use it without an account. */
export async function DeckPage({ kind, searchParams }: { kind: Kind; searchParams: DeckSearchParams }) {
  if (!FLAGS.discovery) notFound();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const market: Market = one(searchParams.market) === "off_market" ? "off_market" : "for_sale";
  const filters = parseFilters(searchParams, kind);
  const areas = parseAreas(one(searchParams.area));
  const area = areas.labels.join(", ");
  const priced = market === "for_sale";

  const ctx = await getSessionContext();
  const supabase = await createClient();
  let query = supabase.from("listings").select(LISTING_COLUMNS).eq("kind", kind).eq("market", market).order("listed_on", { ascending: false, nullsFirst: false }).order("id");
  const or = areaFilter(areas);
  if (or) query = query.or(or);
  // Suggestions for the area box: every town and postcode we have listings for.
  const [{ data: rows }, { data: places }] = await Promise.all([query.limit(1000), supabase.from("listings").select("suburb, state, postcode").limit(1000)]);
  const listings = applyFilters(rows ?? [], filters, market).slice(0, 200);
  const suggestions = [...new Set((places ?? []).map((p) => `${p.suburb} ${p.state} ${p.postcode}`))].sort();

  // Signed-in users: hide listings already saved or passed (latest decision wins).
  let decidedIds: string[] = [];
  if (ctx && listings.length) {
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
  const href = (o: { market?: Market; keepArea?: boolean; keepFilters?: boolean } = {}) => {
    const m = o.market ?? market;
    const p = new URLSearchParams(o.keepFilters === false ? {} : filterParams(filters));
    if (m === "off_market") p.set("market", m);
    if (area && o.keepArea !== false) p.set("area", area);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const count = activeCount(filters, market);
  const deckKey = `${kind}-${market}-${area}-${JSON.stringify(filterParams(filters))}`;

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
            href={href({ market: m })}
            aria-current={market === m ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${
              market === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {MARKET_LABEL[m]}
          </Link>
        ))}
      </nav>

      <form method="get" action={base} role="search" aria-label="Search an area" className="mx-auto flex max-w-md gap-2">
        {market === "off_market" ? <input type="hidden" name="market" value="off_market" /> : null}
        {Object.entries(filterParams(filters)).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label htmlFor="area" className="sr-only">
          Town, suburb or postcode
        </label>
        <div className="relative flex-1">
          <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input id="area" name="area" list="area-suggestions" defaultValue={area} placeholder="Town, suburb or postcode" autoComplete="off" className="block min-h-11 w-full rounded-xl border border-sand-300 bg-white pl-9 pr-3 text-base sm:text-sm" />
          <datalist id="area-suggestions">
            {suggestions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        <button type="submit" className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Search
        </button>
      </form>
      {area ? (
        <p className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-slate-600">Showing</span>
          {areas.labels.map((l) => (
            <Link key={l} href={`/suburbs?q=${encodeURIComponent(l)}`} title={`${l} suburb profile`} className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700 underline-offset-2 hover:underline">
              {l}
            </Link>
          ))}
          <Link href={href({ keepArea: false })} className="inline-flex min-h-11 items-center gap-1 text-slate-600 underline">
            <X aria-hidden="true" className="h-4 w-4" /> All areas
          </Link>
        </p>
      ) : (
        <p className="mx-auto max-w-md text-center text-xs text-slate-500">Separate several towns with commas, e.g. Newcastle, Wollongong.</p>
      )}

      {/* Collapsed by default so the first card is visible quickly on phones. */}
      <details className="mx-auto max-w-md rounded-2xl border border-sand-200 bg-white px-4 py-2" open={count > 0 || undefined}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-slate-800">
          <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> Filters{count ? ` (${count})` : ""}
          </span>
          <span className="truncate font-normal text-slate-600">{summary(filters, market)}</span>
        </summary>
        <form method="get" action={base} className="grid grid-cols-2 gap-3 pb-3 pt-1">
          {market === "off_market" ? <input type="hidden" name="market" value="off_market" /> : null}
          {area ? <input type="hidden" name="area" value={area} /> : null}

          {priced ? (
            <>
              <div>
                <label htmlFor="min" className={labelClass}>
                  Min price
                </label>
                <select id="min" name="min" defaultValue={filters.priceMin ?? ""} className={selectClass}>
                  <option value="">Any</option>
                  {PRICE_STEPS.map((v) => (
                    <option key={v} value={v}>
                      {formatAudCompact(v)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="max" className={labelClass}>
                  Max price
                </label>
                <select id="max" name="max" defaultValue={filters.priceMax ?? ""} className={selectClass}>
                  <option value="">Any</option>
                  {PRICE_STEPS.map((v) => (
                    <option key={v} value={v}>
                      {formatAudCompact(v)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="col-span-2 rounded-xl bg-sand-50 p-2 text-xs text-slate-600">Price filters don&apos;t apply here: off-market homes aren&apos;t for sale and have no price.</p>
          )}

          <fieldset className="col-span-2">
            <legend className={labelClass}>Property type</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => (
                <label key={t} className="cursor-pointer">
                  <input type="checkbox" name="type" value={t} defaultChecked={filters.types.includes(t)} className="peer sr-only" />
                  <span className="inline-flex min-h-11 items-center rounded-full border border-sand-300 bg-white px-4 text-sm font-semibold peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
                    {TYPE_LABEL[t]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {(
            [
              ["beds", "Bedrooms", filters.beds, 5],
              ["baths", "Bathrooms", filters.baths, 3],
              ["cars", "Car spaces", filters.cars, 3],
            ] as const
          ).map(([name, label, value, max]) => (
            <div key={name}>
              <label htmlFor={name} className={labelClass}>
                {label}
              </label>
              <select id={name} name={name} defaultValue={value ? String(value) : ""} className={selectClass}>
                <option value="">Any</option>
                {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label htmlFor="land" className={labelClass}>
              Land size
            </label>
            <select id="land" name="land" defaultValue={filters.landMin ?? ""} className={selectClass}>
              <option value="">Any</option>
              {LAND_STEPS.map((v) => (
                <option key={v} value={v}>
                  {v}+ m²
                </option>
              ))}
            </select>
          </div>
          {kind === "investment" && priced ? (
            <div>
              <label htmlFor="yield" className={labelClass}>
                Gross yield
              </label>
              <select id="yield" name="yield" defaultValue={filters.yieldMin ?? ""} className={selectClass}>
                <option value="">Any</option>
                {YIELD_STEPS.map((v) => (
                  <option key={v} value={v}>
                    {v}%+
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor="state" className={labelClass}>
              State or territory
            </label>
            <select id="state" name="state" defaultValue={filters.state ?? ""} className={selectClass}>
              <option value="">All of Australia</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_INFO[s].name}
                </option>
              ))}
            </select>
          </div>
          {priced ? (
            <div>
              <label htmlFor="sort" className={labelClass}>
                Sort by
              </label>
              <select id="sort" name="sort" defaultValue={filters.sort} className={selectClass}>
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
              Apply
            </button>
            {count || filters.sort !== "newest" ? (
              <Link href={href({ keepFilters: false })} className="inline-flex min-h-11 items-center text-sm text-slate-600 underline">
                Clear filters
              </Link>
            ) : null}
          </div>
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

      {listings.length === 0 ? (
        <p className="mx-auto max-w-md rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center text-slate-600">
          {area
            ? `No ${MARKET_LABEL[market].toLowerCase()} listings in ${area} match. Try a nearby town, fewer filters, or all areas.`
            : "No listings match. Try fewer filters or a wider price range."}
        </p>
      ) : (
        // Re-mount the deck when the filters change so it starts fresh.
        <SwipeDeck key={deckKey} listings={listings} signedIn={Boolean(ctx)} decidedIds={decidedIds} />
      )}
    </div>
  );
}
