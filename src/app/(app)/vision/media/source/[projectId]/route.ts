import { z } from "zod";
import { objectStore } from "@/lib/storage/object-store";
import { createClient } from "@/lib/supabase/server";
import { imageResponse } from "@/lib/vision/serve";

/** The owner's own (metadata-stripped) source photo. RLS decides whether the row is visible. */
export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!z.string().uuid().safeParse(projectId).success) return imageResponse(null, "private");
  const supabase = await createClient();
  const { data } = await supabase.from("visual_projects").select("source_key").eq("id", projectId).maybeSingle();
  return imageResponse(data ? await objectStore(supabase, "vision-sources").get(data.source_key) : null, "private");
}
