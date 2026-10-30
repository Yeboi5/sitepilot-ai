import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MODES, presetLabel, styleLabel, VISION_DISCLAIMER, type VisionMode } from "@/lib/vision/presets";
import { hashShareToken, isShareToken } from "@/lib/vision/share";

// Secret links shouldn't be indexed or leak through the Referer header.
export const metadata: Metadata = { title: "Shared AI concept", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedConceptPage({ params }: { params: Promise<{ token: string }> }) {
  if (!FLAGS.vision) notFound();
  const { token } = await params;
  if (!isShareToken(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_vision", { token_hash: hashShareToken(token) });
  const shared = data?.[0];
  if (!shared) notFound();
  const mode = shared.mode as VisionMode;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-2xl font-extrabold">
        {presetLabel(mode, shared.preset)} concept · {styleLabel(shared.style)}
      </h1>
      <p className="text-sm text-slate-600">
        {MODES[mode].label} · made with SitePilot Vision on {formatDate(shared.created_at)}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- private, dynamic image route */}
      <img src={`/vision/shared/${token}/image`} alt={`AI concept: ${presetLabel(mode, shared.preset)}, ${styleLabel(shared.style)} style`} className="w-full rounded-2xl border border-sand-200" />
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{VISION_DISCLAIMER}</p>
      <Link href="/vision" className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">
        Try SitePilot Vision
      </Link>
    </div>
  );
}
