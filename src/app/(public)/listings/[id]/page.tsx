import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListingCard } from "@/components/discovery/listing-card";
import { SaveToggle } from "@/components/discovery/save-toggle";
import { LISTING_COLUMNS, MARKET_LABEL } from "@/lib/discovery/types";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Listing" };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();
  if (!listing) notFound();

  const ctx = await getSessionContext();
  let saved = false;
  if (ctx) {
    const { data } = await supabase.from("saved_properties").select("listing_id").eq("listing_id", id).maybeSingle();
    saved = Boolean(data);
  }
  const back = `/discover/${listing.kind}${listing.market === "off_market" ? "?market=off_market" : ""}`;
  const provenance = (listing.provenance ?? {}) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={back} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700 underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to {MARKET_LABEL[listing.market]}
      </Link>
      <h1 className="sr-only">{listing.headline}</h1>
      <ListingCard listing={listing} />
      <div className="flex flex-wrap items-start gap-3">
        <SaveToggle listingId={listing.id} signedIn={Boolean(ctx)} initiallySaved={saved} />
      </div>
      <section className="rounded-2xl border border-sand-200 bg-white p-5 text-sm">
        <h2 className="font-display text-lg font-bold">About this listing</h2>
        <p className="mt-2 text-slate-700">{listing.description}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Source</dt>
            <dd>{String(provenance.source ?? "Unknown")}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">As of</dt>
            <dd>{String(provenance.as_of ?? "Unknown")}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Verification</dt>
            <dd className="capitalize">{String(provenance.verification ?? "unverified")}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Licence</dt>
            <dd>{String(provenance.licence ?? "Unknown")}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
