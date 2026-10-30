"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { evidenceStore } from "@/lib/storage/evidence-store";
import { createClient } from "@/lib/supabase/server";

const decisionSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["verified", "rejected"]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});

/**
 * A claim verifier approves or rejects a homeowner claim. `decide_claim` checks the caller is a
 * verifier (not the claimant), records the decision and audits it. The evidence file is then
 * deleted, as promised to the claimant.
 */
export async function decideClaim(formData: FormData) {
  const ctx = await getSessionContext();
  const p = decisionSchema.safeParse({ claimId: formData.get("claimId"), decision: formData.get("decision"), note: formData.get("note") ?? undefined });
  if (!ctx || !p.success) return;
  if (p.data.decision === "rejected" && !p.data.note) return; // a rejection must tell the claimant why
  const supabase = await createClient();
  const { data: key, error } = await supabase.rpc("decide_claim", { claim: p.data.claimId, decision: p.data.decision, note: p.data.note ?? "" });
  if (error) return;
  if (key) {
    await evidenceStore(supabase).remove(key);
    await supabase.rpc("clear_claim_evidence", { claim: p.data.claimId });
  }
  revalidatePath("/verify");
}
