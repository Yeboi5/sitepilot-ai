import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ClaimForm } from "@/components/my-property/forms";
import { Card, PageHeader } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Claim this home" };

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FLAGS.myProperty || !FLAGS.homeownerClaims) notFound();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await requireOrg();
  const supabase = await createClient();
  const { data: home } = await supabase.from("owned_properties").select("id, address, suburb, state, postcode").eq("id", id).eq("user_id", ctx.user.id).maybeSingle();
  if (!home) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <p className="text-sm">
        <Link href={`/my-property/${home.id}`} className="text-brand-700 underline">
          ← Back
        </Link>
      </p>
      <PageHeader title="Claim this home" description={`${home.address}, ${home.suburb} ${home.state} ${home.postcode}`} />
      <Card className="space-y-3 text-sm text-slate-700">
        <p>Claiming lets you switch on buyer enquiries and shows you&apos;re the verified owner, to you only. It is never published.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A SitePilot reviewer checks your document against the address. Every view is logged.</li>
          <li>Your claim stays pending until it&apos;s reviewed.</li>
          <li>Your document is deleted once a decision is made.</li>
        </ul>
      </Card>
      <Card>
        <ClaimForm ownedId={home.id} />
      </Card>
    </div>
  );
}
