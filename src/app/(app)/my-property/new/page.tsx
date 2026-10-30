import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AddHomeForm } from "@/components/my-property/forms";
import { Card, PageHeader } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add my home" };

export default async function NewHomePage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  if (!FLAGS.myProperty) notFound();
  await requireOrg();
  const { record } = await searchParams;
  let prefill = {};
  if (record && z.string().uuid().safeParse(record).success) {
    const supabase = await createClient();
    const { data } = await supabase.from("property_records").select("id, street_address, suburb, state, postcode").eq("id", record).maybeSingle();
    if (data) prefill = { recordId: data.id, address: data.street_address ?? "", suburb: data.suburb, state: data.state, postcode: data.postcode };
  }
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Add my home" description="Keep notes, plan maintenance and explore ideas for the home you own." />
      <Card>
        <AddHomeForm prefill={prefill} />
      </Card>
    </div>
  );
}
