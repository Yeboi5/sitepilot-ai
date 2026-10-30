import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decideClaim } from "@/app/(app)/verify/actions";
import { Card, PageHeader } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verify claims" };

const button = "inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold";

/** Manual homeowner-claim review queue (Blueprint v2.0 decision 4). Verifiers only. */
export default async function VerifyPage() {
  if (!FLAGS.homeownerClaims) notFound();
  await requireOrg();
  const supabase = await createClient();
  const { data: isVerifier } = await supabase.rpc("am_i_claim_verifier");
  if (!isVerifier) notFound();

  const { data: claims } = await supabase
    .from("homeowner_claims")
    .select("id, created_at, declared_at, evidence_name, home:owned_properties(address, suburb, state, postcode)")
    .eq("status", "pending")
    .order("created_at");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Verify homeowner claims"
        description="Check the document shows the claimant's name against this address (e.g. a rates notice or title search). Every evidence view and decision is audited. Documents are deleted after a decision."
      />
      {(claims ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No claims waiting for review.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {(claims ?? []).map((c) => (
            <li key={c.id}>
              <Card className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold">{c.home ? `${c.home.address}, ${c.home.suburb} ${c.home.state} ${c.home.postcode}` : "Address unavailable"}</p>
                  <p className="text-slate-500">Submitted {formatDate(c.created_at)} · owner declaration made</p>
                </div>
                <a href={`/verify/evidence/${c.id}`} className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">
                  Download evidence{c.evidence_name ? ` (${c.evidence_name})` : ""}
                </a>
                <form action={decideClaim}>
                  <input type="hidden" name="claimId" value={c.id} />
                  <button name="decision" value="verified" className={`${button} bg-leaf-600 text-white hover:bg-leaf-700`}>
                    Verify owner
                  </button>
                </form>
                <form action={decideClaim} className="flex flex-wrap items-end gap-2 border-t border-sand-100 pt-3">
                  <input type="hidden" name="claimId" value={c.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <label className="min-w-[12rem] flex-1">
                    <span className="font-medium">Reason (shown to the claimant)</span>
                    <input name="note" required minLength={3} maxLength={500} className="mt-1 block min-h-11 w-full rounded-xl border border-sand-300 px-3" />
                  </label>
                  <button type="submit" className={`${button} border border-red-300 bg-white text-red-700 hover:bg-red-50`}>
                    Reject
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
