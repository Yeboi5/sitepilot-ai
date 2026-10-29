import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { listScenarios } from "@/lib/scenarios";
import type { SessionContext } from "@/lib/session";
import { buildReport, type ReportInput, type ReportModel } from "./model";
export { reportFileName } from "./model";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Property = {
  id: string;
  address: string;
  suburb: string | null;
  postcode: string | null;
  jurisdiction: string;
  lot_dp: string | null;
  is_demo: boolean;
};

/** Gathers everything the report shows. All reads go through RLS as the signed-in investor. */
export async function loadReport(supabase: Supabase, ctx: SessionContext & { active: NonNullable<SessionContext["active"]> }, property: Property): Promise<ReportModel> {
  const [{ data: evidence }, scenarios, { data: documents }] = await Promise.all([
    supabase
      .from("evidence")
      .select("title, source_type, source_url, fetched_at, verification_status, verified_at, notes, is_demo, verifier:users!evidence_verified_by_fkey(display_name)")
      .eq("property_id", property.id)
      .order("fetched_at", { ascending: false }),
    listScenarios(supabase, property.id),
    supabase
      .from("documents")
      .select("file_name, findings(category, extracted_text, page_ref, confidence, status, reviewed_at, reviewer_note, reviewer:users!findings_reviewer_id_fkey(display_name))")
      .eq("property_id", property.id)
      .order("created_at"),
  ]);

  const input: ReportInput = {
    generatedAt: new Date(),
    generatedBy: ctx.user.display_name,
    organisation: ctx.active.organisation.name,
    property: {
      address: property.address,
      suburb: property.suburb,
      postcode: property.postcode,
      jurisdiction: property.jurisdiction,
      lotDp: property.lot_dp,
      isDemo: property.is_demo,
    },
    evidence: (evidence ?? []).map((e) => ({
      title: e.title,
      sourceType: e.source_type,
      sourceUrl: e.source_url,
      fetchedAt: e.fetched_at,
      status: e.verification_status,
      verifiedBy: e.verifier?.display_name ?? null,
      verifiedAt: e.verified_at,
      notes: e.notes,
      isDemo: e.is_demo,
    })),
    scenarios: scenarios
      .filter((s) => s.assumptions && s.result)
      .map((s) => ({ name: s.name, assumptions: s.assumptions!, result: s.result! })),
    findings: (documents ?? []).flatMap((d) =>
      d.findings.map((f) => ({
        document: d.file_name,
        category: f.category,
        text: f.extracted_text,
        page: f.page_ref,
        confidence: f.confidence,
        status: f.status,
        reviewer: f.reviewer?.display_name ?? null,
        reviewedAt: f.reviewed_at,
        reviewerNote: f.reviewer_note,
      })),
    ),
  };
  return buildReport(input);
}
