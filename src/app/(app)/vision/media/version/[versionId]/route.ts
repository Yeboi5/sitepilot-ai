import { z } from "zod";
import { objectStore } from "@/lib/storage/object-store";
import { createClient } from "@/lib/supabase/server";
import { imageResponse } from "@/lib/vision/serve";

/** One of the owner's watermarked concepts. `?download=1` saves it as a file. */
export async function GET(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!z.string().uuid().safeParse(versionId).success) return imageResponse(null, "private");
  const supabase = await createClient();
  const { data } = await supabase.from("visual_versions").select("output_key").eq("id", versionId).maybeSingle();
  const res = imageResponse(data ? await objectStore(supabase, "vision-outputs").get(data.output_key) : null, "private");
  if (res.ok && new URL(req.url).searchParams.get("download") === "1") {
    res.headers.set("Content-Disposition", `attachment; filename="sitepilot-ai-concept.jpg"`);
  }
  return res;
}
