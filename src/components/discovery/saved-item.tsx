"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { recordDecision } from "@/app/(public)/discover/actions";
import type { Listing } from "@/lib/discovery/types";
import { DemoTag, NotForSaleTag } from "./listing-card";
import { PropertyIllustration } from "./property-illustration";

/** One row on the Saved page. `onRemove` handles guests; signed-in users remove via the server. */
export function SavedItem({ listing: l, onRemove }: { listing: Listing; onRemove?: () => void }) {
  const [pending, startTransition] = useTransition();
  const remove = () => {
    if (onRemove) return onRemove();
    startTransition(async () => {
      await recordDecision({ listingId: l.id, action: "unsave", source: "list" });
    });
  };
  return (
    <li className="flex gap-3 rounded-2xl border border-sand-200 bg-white p-3 shadow-sm">
      <PropertyIllustration type={l.property_type} kind={l.kind} seed={l.illustration_seed} className="h-20 w-24 shrink-0 rounded-xl" />
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
