import { objectStore } from "@/lib/storage/object-store";
import { createClient } from "@/lib/supabase/server";
import { imageResponse } from "@/lib/vision/serve";
import { hashShareToken, isShareToken } from "@/lib/vision/share";

/** A shared concept (watermarked output only). Works for guests; the token is the capability. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isShareToken(token)) return imageResponse(null, "shared");
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_vision", { token_hash: hashShareToken(token) });
  const row = data?.[0];
  return imageResponse(row ? await objectStore(supabase, "vision-outputs").get(row.output_key) : null, "shared");
}
