import { assumptionsSchema } from "@/lib/finance/assumptions";
import { calculate } from "@/lib/finance/feasibility";

/**
 * Development feasibility for Compare (stage C6). A property's development category is scored only
 * when its linked workspace has BOTH:
 *  - at least one official planning record (certificate, portal record, LEP map or council record)
 *    marked verified, and never a DEMO record (the database forbids verifying those); and
 *  - a complete develop-and-sell scenario (build cost and an assumed sale value entered).
 * Otherwise it stays "insufficient evidence", and we say what's missing.
 */
export const OFFICIAL_PLANNING_SOURCES = ["planning_certificate", "planning_portal", "lep_map", "council_record"] as const;

export type WorkspaceEvidence = { source_type: string; verification_status: string; is_demo: boolean };
export type WorkspaceScenario = { id: string; name: string; assumptions_json: unknown; updated_at: string };

export type DevelopmentStatus = {
  workspaceId: string;
  verifiedOfficial: number;
  scenario: { id: string; name: string; roi: number | null; complete: boolean } | null;
  /** Return on cost used for scoring, or null with `missing` explaining why. */
  roi: number | null;
  missing: string[];
};

export function assessDevelopment(workspaceId: string, evidence: WorkspaceEvidence[], scenarios: WorkspaceScenario[]): DevelopmentStatus {
  const verifiedOfficial = evidence.filter(
    (e) => e.verification_status === "verified" && !e.is_demo && (OFFICIAL_PLANNING_SOURCES as readonly string[]).includes(e.source_type),
  ).length;

  // The most recently updated develop-and-sell scenario.
  let scenario: DevelopmentStatus["scenario"] = null;
  for (const s of [...scenarios].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
    const parsed = assumptionsSchema.safeParse(s.assumptions_json);
    if (!parsed.success || parsed.data.strategy !== "develop_and_sell") continue;
    const complete = parsed.data.hard.construction > 0 && parsed.data.sale.grossRealisation > 0 && parsed.data.land.amount > 0;
    scenario = { id: s.id, name: s.name, complete, roi: complete ? (calculate(parsed.data).sale?.roi ?? null) : null };
    break;
  }

  const missing: string[] = [];
  if (!verifiedOfficial) missing.push("verify an official planning record (e.g. a planning certificate) in the workspace");
  if (!scenario) missing.push("add a develop-and-sell scenario");
  else if (!scenario.complete) missing.push("finish the scenario: add build costs and an assumed sale value");
  const roi = !missing.length && scenario?.roi != null ? scenario.roi : null;
  return { workspaceId, verifiedOfficial, scenario, roi, missing };
}
