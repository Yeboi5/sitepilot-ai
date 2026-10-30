import { Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, PageHeader } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { MODES, VISION_DISCLAIMER, type VisionMode } from "@/lib/vision/presets";

export const metadata: Metadata = { title: "SitePilot Vision" };

const POINTS = [
  "Upload your own photo: from above, the street, or inside",
  "Try a pool, granny flat, new facade, kitchen and more, then compare before and after",
  "Every image is marked AI CONCEPT. It's an idea, not a plan or an approval",
  "Private by default. Share only if you choose",
];

export default async function VisionPage() {
  if (!FLAGS.vision) notFound();
  const ctx = await getSessionContext();

  if (!ctx) {
    return (
      <div className="mx-auto max-w-2xl py-6 text-center sm:py-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-leaf-100 text-brand-700">
          <Sparkles aria-hidden="true" className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">SitePilot Vision</h1>
        <p className="mt-3 text-slate-700">See what a property could become, from a photo you&apos;re allowed to use.</p>
        <ul className="mx-auto mt-6 max-w-md space-y-2 rounded-2xl border border-sand-200 bg-white p-5 text-left text-sm text-slate-700">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf-500" />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/sign-up">Create a free account</ButtonLink>
          <ButtonLink href="/sign-in?next=/vision/new" variant="secondary">
            Sign in to start
          </ButtonLink>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: projects }, { data: credits }] = await Promise.all([
    supabase.from("visual_projects").select("id, title, mode, created_at, visual_versions(count)").order("created_at", { ascending: false }),
    supabase.rpc("vision_credits_left"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SitePilot Vision"
        description="AI concepts from your own photos. Private unless you share them."
        actions={
          <ButtonLink href="/vision/new">
            <Plus aria-hidden="true" className="h-4 w-4" /> New project
          </ButtonLink>
        }
      />
      <p className="text-sm text-slate-600">{credits ?? 0} of 10 concepts left today.</p>
      {(projects ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center text-sm text-slate-600">
          No projects yet. Start with a photo of your backyard, the front of your home, or a room.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Vision projects">
          {(projects ?? []).map((p) => (
            <li key={p.id}>
              <Link href={`/vision/${p.id}`} className="block overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm hover:shadow">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, dynamic image route */}
                <img src={`/vision/media/source/${p.id}`} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <span className="block p-3">
                  <span className="block font-semibold">{p.title}</span>
                  <span className="text-xs text-slate-600">
                    {MODES[p.mode as VisionMode].label} · {p.visual_versions[0]?.count ?? 0} concepts · {formatDate(p.created_at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">{VISION_DISCLAIMER}</p>
    </div>
  );
}
