"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { recordDecision } from "@/app/(public)/discover/actions";
import type { Listing } from "@/lib/discovery/types";
import { DemoTag, NotForSaleTag } from "./listing-card";
import { PropertyIllustration } from "./property-illustration";

/** One row on the Saved page. `onRemove` handles guests; signed-in users remove via the server. */
export type Selectable = { checked: boolean; disabled: boolean; onChange: () => void };

export function SavedItem({ listing: l, onRemove, select, layout = "list" }: { listing: Listing; onRemove?: () => void; select?: Selectable; layout?: "list" | "grid" }) {
  const [pending, startTransition] = useTransition();
  const remove = () => {
    if (onRemove) return onRemove();
    startTransition(async () => {
      await recordDecision({ listingId: l.id, action: "unsave", source: "list" });
    });
  };
  return (
    <li
      className={`flex gap-3 rounded-2xl border bg-white p-3 shadow-sm ${select?.checked ? "border-brand-500 ring-1 ring-brand-500" : "border-sand-200"} ${layout === "grid" ? "flex-col" : ""}`}
    >
      {select ? (
        <label className={`flex shrink-0 cursor-pointer items-center ${layout === "grid" ? "gap-2 text-sm font-medium" : "w-8 justify-center self-center"}`}>
          <input type="checkbox" checked={select.checked} disabled={select.disabled} onChange={select.onChange} className="h-5 w-5 accent-brand-600" />
          <span className={layout === "grid" ? "" : "sr-only"}>Compare {layout === "grid" ? "" : l.headline}</span>
        </label>
      ) : null}
      <PropertyIllustration
        type={l.property_type}
        kind={l.kind}
        seed={l.illustration_seed}
        className={layout === "grid" ? "aspect-[4/3] w-full rounded-xl" : "h-20 w-24 shrink-0 rounded-xl"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {l.is_demo ? <DemoTag /> : null}
          {l.market === "off_market" ? <NotForSaleTag /> : null}
        </div>
        <Link href={`/listings/${l.id}`} className="mt-1 block font-semibold text-slate-900 hover:underline">
          {l.headline}
        </Link>
        <p className="text-sm text-slate-600">
          {l.market === "off_market" ? "Not for sale" : l.price_display} · {l.suburb} {l.state}
        </p>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl text-slate-500 hover:bg-sand-100 hover:text-red-700"
      >
        <Trash2 aria-hidden="true" className="h-5 w-5" />
        <span className="sr-only">Remove {l.headline} from saved</span>
      </button>
    </li>
  );
}
