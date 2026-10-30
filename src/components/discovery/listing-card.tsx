import { AlertTriangle, Bath, BedDouble, Car, Info, Lightbulb, Ruler } from "lucide-react";
import Link from "next/link";
import { grossYield, SIGNALS_VERSION } from "@/lib/discovery/signals";
import type { Listing } from "@/lib/discovery/types";
import { formatRatio } from "@/lib/format";
import { PropertyIllustration } from "./property-illustration";

/** Shared by the swipe deck (client) and the detail and saved pages (server); no server-only code. */

export function DemoTag() {
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold tracking-wide text-amber-900 ring-1 ring-amber-300">DEMO</span>
  );
}

export function NotForSaleTag() {
  return <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold tracking-wide text-white">NOT FOR SALE</span>;
}

function Facts({ l }: { l: Listing }) {
  const items = [
    l.bedrooms ? { icon: BedDouble, text: `${l.bedrooms} bed` } : null,
    l.bathrooms ? { icon: Bath, text: `${l.bathrooms} bath` } : null,
    l.car_spaces ? { icon: Car, text: `${l.car_spaces} car` } : null,
    l.land_area_sqm ? { icon: Ruler, text: `${l.land_area_sqm} m²` } : null,
  ].filter(Boolean) as { icon: typeof BedDouble; text: string }[];
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
      {items.map((it) => (
        <li key={it.text} className="flex items-center gap-1.5">
          <it.icon aria-hidden="true" className="h-4 w-4 text-slate-500" />
          {it.text}
        </li>
      ))}
    </ul>
  );
}

function location(l: Listing) {
  return `${l.suburb} ${l.state} ${l.postcode}`;
}

export function ListingCard({ listing: l, detailHref, compact = false }: { listing: Listing; detailHref?: string; compact?: boolean }) {
  const offMarket = l.market === "off_market";
  const yieldValue = l.kind === "investment" ? grossYield(l.asking_price, l.indicative_weekly_rent) : null;
  const asOf = typeof l.provenance === "object" && l.provenance && "as_of" in l.provenance ? String(l.provenance.as_of) : null;

  return (
    <article
      aria-label={`${l.headline}, ${location(l)}`}
      className={`overflow-hidden rounded-3xl border bg-white shadow-md ${l.kind === "home" ? "border-brand-100" : "border-leaf-100"}`}
    >
      <div className="relative">
        <PropertyIllustration type={l.property_type} kind={l.kind} seed={l.illustration_seed} className={`w-full ${compact ? "h-32" : "h-36 sm:h-56"}`} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {l.is_demo ? <DemoTag /> : null}
          {offMarket ? <NotForSaleTag /> : null}
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <p className={`font-display text-2xl font-extrabold ${offMarket ? "text-slate-700" : "text-slate-900"}`}>
            {offMarket ? "Not for sale" : l.price_display}
            {l.is_demo && !offMarket ? <span className="ml-2 align-middle text-xs font-semibold text-amber-800">illustrative price</span> : null}
          </p>
          <h3 className="mt-0.5 font-semibold text-slate-900">{l.headline}</h3>
          <p className="text-sm text-slate-600">
            {l.street_address ? `${l.street_address}, ` : offMarket ? "Suburb only · " : ""}
            {location(l)}
          </p>
        </div>

        <Facts l={l} />

        {offMarket ? (
          <p className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
            Off-market potential is speculative. This property is not listed for sale and the owner hasn&apos;t indicated
            they want to sell. Owner details are never shown.
          </p>
        ) : null}

        {l.kind === "home" && l.lifestyle_tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Features">
            {l.lifestyle_tags.map((t) => (
              <li key={t} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                {t}
              </li>
            ))}
          </ul>
        ) : null}

        {l.kind === "investment" ? (
          <div className="space-y-2 rounded-2xl bg-leaf-50 p-3 text-sm">
            {!offMarket ? (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-700">Indicative gross yield</span>
                <span className="font-display text-lg font-bold text-leaf-700">{yieldValue === null ? "n/a" : formatRatio(yieldValue)}</span>
              </div>
            ) : null}
            {l.development_idea ? (
              <p className="flex gap-2 text-slate-700">
                <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" />
                <span>
                  <span className="font-medium">Idea:</span> {l.development_idea}
                </span>
              </p>
            ) : null}
            {l.risk_flags.length > 0 ? (
              <ul className="space-y-1">
                {l.risk_flags.map((r) => (
                  <li key={r} className="flex gap-2 text-amber-900">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="sr-only">Check: </span>
                      {r}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <details className="text-xs text-slate-600">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-slate-700">
                <Info aria-hidden="true" className="h-3.5 w-3.5" /> Assumptions and source
              </summary>
              <ul className="mt-1.5 space-y-0.5 pl-1">
                {l.indicative_weekly_rent ? <li>Rent: ${l.indicative_weekly_rent}/week, a demo assumption (unverified)</li> : null}
                {!offMarket ? <li>Gross yield = weekly rent × 52 ÷ price ({SIGNALS_VERSION}); before costs and tax</li> : null}
                <li>Source: SitePilot demo data{asOf ? `, as of ${asOf}` : ""}. Not market data</li>
                <li>Ideas and risks are prompts to check with council and licensed professionals</li>
              </ul>
            </details>
          </div>
        ) : null}

        {detailHref ? (
          <Link href={detailHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline">
            View details
          </Link>
        ) : null}
      </div>
    </article>
  );
}
