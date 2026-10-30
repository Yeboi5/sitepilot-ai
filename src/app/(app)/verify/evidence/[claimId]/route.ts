import { z } from "zod";
import { evidenceStore } from "@/lib/storage/evidence-store";
import { createClient } from "@/lib/supabase/server";

/**
 * Streams a claim's evidence to a verifier. Access is checked by `record_claim_evidence_view`
 * (verifier, claim pending or decided by them), which also writes an audit event. Always served
 * as a download so the browser never renders untrusted content inline.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  if (!z.string().uuid().safeParse(claimId).success) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: key, error } = await supabase.rpc("record_claim_evidence_view", { claim: claimId });
  if (error || !key) return new Response("Not found", { status: 404 });
  const { data: claim } = await supabase.from("homeowner_claims").select("evidence_mime").eq("id", claimId).maybeSingle();
  const body = await evidenceStore(supabase).get(key);
  if (!body) return new Response("Not found", { status: 404 });
  const ext = key.split(".").pop() ?? "bin";
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": claim?.evidence_mime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="claim-evidence.${ext}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
