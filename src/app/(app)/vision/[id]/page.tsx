import { Download, Link2, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { deleteProject, deleteVersion, shareVersion, unshareVersion } from "@/app/(app)/vision/actions";
import { Card, PageHeader } from "@/components/ui";
import { CompareSlider } from "@/components/vision/compare-slider";
import { GenerateForm } from "@/components/vision/forms";
import { ShareLink } from "@/components/vision/share-link";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { MODES, presetLabel, styleLabel, VISION_DISCLAIMER, type VisionMode } from "@/lib/vision/presets";
import { isShareToken } from "@/lib/vision/share";

export const metadata: Metadata = { title: "Vision project", referrer: "no-referrer" };

const smallButton = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-sand-300 bg-white px-3 text-sm font-semibold hover:bg-sand-100";

export default async function VisionProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; link?: string }> }) {
  if (!FLAGS.vision) notFound();
  const { id } = await params;
  const { v, link } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireOrg();
  const supabase = await createClient();

  const [{ data: project }, { data: versions }, { data: credits }] = await Promise.all([
    supabase.from("visual_projects").select("id, title, mode, created_at, home:owned_properties(id, nickname, address)").eq("id", id).maybeSingle(),
    supabase.from("visual_versions").select("id, preset, style, prompt, created_at, shared_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.rpc("vision_credits_left"),
  ]);
  if (!project) notFound();
  const mode = project.mode as VisionMode;
  const selected = (versions ?? []).find((x) => x.id === v) ?? versions?.[0];
  const ref = (versionId: string) => (
    <>
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="versionId" value={versionId} />
    </>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <p className="text-sm">
        <Link href="/vision" className="text-brand-700 underline">
          ← SitePilot Vision
        </Link>
      </p>
      <PageHeader
        title={project.title}
        description={
          <>
            {MODES[mode].label} photo · {formatDate(project.created_at)}
            {project.home ? (
              <>
                {" · "}
                <Link href={`/my-property/${project.home.id}`} className="underline">
                  {project.home.nickname ?? project.home.address}
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-3">
          {selected ? (
            <>
              <CompareSlider
                before={`/vision/media/source/${project.id}`}
                after={`/vision/media/version/${selected.id}`}
                beforeAlt="Your original photo"
                afterAlt={`AI concept: ${presetLabel(mode, selected.preset)}, ${styleLabel(selected.style)} style`}
              />
              <p className="text-sm">
                <span className="font-semibold">
                  {presetLabel(mode, selected.preset)} · {styleLabel(selected.style)}
                </span>
                {selected.prompt ? <span className="text-slate-600"> · &ldquo;{selected.prompt}&rdquo;</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={`/vision/media/version/${selected.id}?download=1`} className={smallButton}>
                  <Download aria-hidden="true" className="h-4 w-4" /> Download
                </a>
                {selected.shared_at ? (
                  <form action={unshareVersion}>
                    {ref(selected.id)}
                    <button type="submit" className={smallButton}>
                      Stop sharing
                    </button>
                  </form>
                ) : (
                  <form action={shareVersion}>
                    {ref(selected.id)}
                    <button type="submit" className={smallButton}>
                      <Link2 aria-hidden="true" className="h-4 w-4" /> Create share link
                    </button>
                  </form>
                )}
                <form action={deleteVersion}>
                  {ref(selected.id)}
                  <button type="submit" className={smallButton}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete version
                  </button>
                </form>
              </div>
              {selected.shared_at && link && isShareToken(link) ? (
                <div role="status" className="rounded-2xl bg-leaf-50 p-3 text-sm">
                  <p className="font-semibold">Share link created. Copy it now; we only show it once.</p>
                  <ShareLink path={`/vision/shared/${link}`} />
                  <p className="mt-1 text-xs text-slate-600">Anyone with the link sees this watermarked concept only, not your original photo or address.</p>
                </div>
              ) : selected.shared_at ? (
                <p className="text-sm text-slate-600">Shared since {formatDate(selected.shared_at)}. Stop sharing to turn the link off.</p>
              ) : null}
            </>
          ) : (
            <figure className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, dynamic image route */}
              <img src={`/vision/media/source/${project.id}`} alt="Your original photo" className="w-full rounded-2xl border border-sand-200" />
              <figcaption className="text-sm text-slate-600">Your photo. Create a concept to compare before and after.</figcaption>
            </figure>
          )}
          <p className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">{VISION_DISCLAIMER}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Create a concept</h2>
            <GenerateForm projectId={project.id} mode={mode} creditsLeft={credits ?? 0} />
            <p className="mt-3 text-xs text-slate-500">
              Preview mode: concepts are drawn by a built-in mock, not a real AI image model, so your description isn&apos;t used yet.
            </p>
          </Card>
          {(versions ?? []).length ? (
            <Card>
              <h2 className="font-semibold">Versions</h2>
              <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="Versions">
                {(versions ?? []).map((x) => (
                  <li key={x.id}>
                    <Link
                      href={`/vision/${project.id}?v=${x.id}`}
                      aria-current={x.id === selected?.id ? "true" : undefined}
                      className="block overflow-hidden rounded-xl border-2 border-transparent aria-[current]:border-brand-600"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/vision/media/version/${x.id}`} alt={`${presetLabel(mode, x.preset)}, ${styleLabel(x.style)}`} className="aspect-square w-full object-cover" loading="lazy" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-red-700 underline">Delete this project</summary>
        <form action={deleteProject} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="projectId" value={project.id} />
          <span className="text-slate-700">Deletes your photo, every concept and any share links.</span>
          <button type="submit" className="min-h-11 rounded-xl bg-red-700 px-3 font-semibold text-white">
            Delete permanently
          </button>
        </form>
      </details>
    </div>
  );
}
