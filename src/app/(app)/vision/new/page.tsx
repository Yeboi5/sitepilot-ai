import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { NewProjectForm } from "@/components/vision/forms";
import { FLAGS } from "@/lib/flags";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New Vision project" };

export default async function NewVisionProjectPage({ searchParams }: { searchParams: Promise<{ home?: string }> }) {
  if (!FLAGS.vision) notFound();
  await requireOrg();
  const { home } = await searchParams;
  const supabase = await createClient();
  const { data: homes } = FLAGS.myProperty
    ? await supabase.from("owned_properties").select("id, nickname, address, suburb").order("created_at")
    : { data: [] };
  const options = (homes ?? []).map((h) => ({ id: h.id, label: `${h.nickname ?? h.address}, ${h.suburb}` }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-sm">
        <Link href="/vision" className="text-brand-700 underline">
          ← SitePilot Vision
        </Link>
      </p>
      <PageHeader title="New Vision project" description="Start from a photo you took or have permission to use. It stays private to you." />
      <Card>
        <NewProjectForm homes={options} defaultHome={options.some((o) => o.id === home) ? home : undefined} />
      </Card>
    </div>
  );
}
