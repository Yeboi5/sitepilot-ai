import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListingCard } from "@/components/discovery/listing-card";
import { SaveToggle } from "@/components/discovery/save-toggle";
import { EnquiryForm } from "@/components/my-property/forms";
import { withdrawEnquiry } from "./enquiry-actions";
import { analyseListing } from "@/app/(app)/analyse/actions";
import { Badge } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { suburbHref } from "@/lib/suburbs/load";
import { LISTING_COLUMNS, MARKET_LABEL } from "@/lib/discovery/types";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Listing" };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select(`${LISTING_COLUMNS}, property_record_id`).eq("id", id).maybeSingle();
  if (!listing) notFound();

  const ctx = await getSessionContext();
  let saved = false;
  if (ctx) {
    const { data } = await supabase.from("saved_properties").select("listing_id").eq("listing_id", id).maybeSingle();
    saved = Boolean(data);
  }
  // Off-market enquiries: only offered when a verified owner has opted in. The RPC returns an
  // opaque id, never who the owner is.
  const enquiries = FLAGS.buyerEnquiries && listing.market === "off_market";
  let target: string | null = null;
  let mine: { id: string; message: string; status: string; owner_reply: string | null; created_at: string }[] = [];
  if (enquiries && ctx && listing.property_record_id) {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.rpc("enquiry_target_for_record", { record: listing.property_record_id }),
      supabase
        .from("buyer_enquiries")
        .select("id, message, status, owner_reply, created_at, owned_property_id")
        .eq("buyer_id", ctx.user.id)
        .order("created_at", { ascending: false }),
    ]);
    target = t ?? null;
    mine = (m ?? []).filter((e) => e.owned_property_id === target);
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
        <Link href={suburbHref(listing.state, listing.suburb, listing.postcode)} className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-4 text-sm font-semibold hover:bg-sand-100">
          {listing.suburb} suburb profile
        </Link>
        {listing.market === "for_sale" ? (
          ctx ? (
            <form action={analyseListing}>
              <input type="hidden" name="listingId" value={listing.id} />
              <button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-4 text-sm font-semibold hover:bg-sand-100">
                Analyse this deal
              </button>
            </form>
          ) : (
            <Link href={`/sign-in?next=/listings/${listing.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-4 text-sm font-semibold hover:bg-sand-100">
              Sign in to analyse this deal
            </Link>
          )
        ) : null}
      </div>
      {enquiries ? (
        <section className="rounded-2xl border border-sand-200 bg-white p-5 text-sm" aria-labelledby="enquiry-heading">
          <h2 id="enquiry-heading" className="font-display text-lg font-bold">
            Register interest
          </h2>
          <p className="mt-1 text-slate-600">This home is NOT FOR SALE. A message only lets the owner know you&apos;d be interested if they ever decide to sell.</p>
          {!ctx ? (
            <p className="mt-3">
              <Link href={`/sign-in?next=/listings/${listing.id}`} className="font-semibold text-brand-700 underline">
                Sign in to register interest
              </Link>
            </p>
          ) : target ? (
            <div className="mt-3 space-y-4">
              {mine.map((e) => (
                <div key={e.id} className="space-y-2 rounded-2xl bg-sand-50 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>You · {formatDate(e.created_at)}</span>
                    <Badge tone={e.status === "replied" ? "success" : e.status === "open" ? "info" : "neutral"}>{e.status}</Badge>
                  </div>
                  <p>{e.message}</p>
                  {e.owner_reply ? <p className="rounded-xl bg-leaf-50 p-2">Owner replied: {e.owner_reply}</p> : null}
                  {e.status === "open" || e.status === "replied" ? (
                    <form action={withdrawEnquiry}>
                      <input type="hidden" name="enquiryId" value={e.id} />
                      <input type="hidden" name="listingId" value={listing.id} />
                      <button type="submit" className="min-h-11 text-sm underline">
                        Withdraw
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
              <EnquiryForm listingId={listing.id} />
              <p className="text-xs text-slate-500">
                Messages go through SitePilot. Your contact details aren&apos;t shared. If you both want to proceed, a conveyancer or lawyer should handle title
                searches and the contract.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-slate-600">The owner isn&apos;t accepting enquiries for this home.</p>
          )}
        </section>
      ) : null}
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
