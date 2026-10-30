import { CheckCircle2, Clock, Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Property" };

export default async function MyPropertyList() {
  if (!FLAGS.myProperty) notFound();
  await requireOrg();
  const supabase = await createClient();
  const { data } = await supabase
    .from("owned_properties")
    .select("id, nickname, address, suburb, state, postcode, homeowner_claims(status)")
    .order("created_at");
  const homes = data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="My Property"
        description="Look after and improve the home you own. Private to you."
        actions={<ButtonLink href="/search">Add my home</ButtonLink>}
      />
      {homes.length === 0 ? (
        <EmptyState title="No homes yet">
          <Link href="/search" className="text-brand-700 underline">
            Search for your address
          </Link>{" "}
          or{" "}
          <Link href="/my-property/new" className="text-brand-700 underline">
            add it manually
          </Link>
          .
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {homes.map((h) => {
            const verified = h.homeowner_claims.some((c) => c.status === "verified");
            const pending = h.homeowner_claims.some((c) => c.status === "pending");
            return (
              <li key={h.id}>
                <Link href={`/my-property/${h.id}`} className="flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm hover:border-brand-200">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-700">
                    <Home aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{h.nickname ?? h.address}</span>
                    <span className="block text-sm text-slate-600">
                      {h.address}, {h.suburb} {h.state} {h.postcode}
                    </span>
                  </span>
                  {verified ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-leaf-700">
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Verified owner
                    </span>
                  ) : pending ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-800">
                      <Clock aria-hidden="true" className="h-4 w-4" /> Claim pending
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
