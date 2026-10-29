import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { assumptionsSchema, type Assumptions } from "@/lib/finance/assumptions";
import { FORMULA_VERSION, calculate, type FeasibilityResult } from "@/lib/finance/feasibility";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type LoadedScenario = {
  id: string;
  name: string;
  propertyId: string;
  updatedAt: string;
  savedFormulaVersion: string;
  /** Null if the stored assumptions no longer validate (e.g. after a schema change). */
  assumptions: Assumptions | null;
  /**
   * Always recalculated from the stored assumptions with the current formula, so displayed
   * figures can't drift from (or be forged independently of) the inputs. Saved result rows
   * are the history.
   */
  result: FeasibilityResult | null;
  recalculated: boolean;
};

export function hydrate(row: {
  id: string;
  name: string;
  property_id: string;
  updated_at: string;
  formula_version: string;
  assumptions_json: unknown;
}): LoadedScenario {
  const parsed = assumptionsSchema.safeParse(row.assumptions_json);
  const assumptions = parsed.success ? parsed.data : null;
  return {
    id: row.id,
    name: row.name,
    propertyId: row.property_id,
    updatedAt: row.updated_at,
    savedFormulaVersion: row.formula_version,
    assumptions,
    result: assumptions ? calculate(assumptions) : null,
    recalculated: row.formula_version !== FORMULA_VERSION,
  };
}

const COLUMNS = "id, name, property_id, updated_at, formula_version, assumptions_json";

export async function listScenarios(supabase: Supabase, propertyId: string) {
  const { data } = await supabase.from("scenarios").select(COLUMNS).eq("property_id", propertyId).order("created_at");
  return (data ?? []).map(hydrate);
}

export async function getScenario(supabase: Supabase, propertyId: string, scenarioId: string) {
  const { data } = await supabase.from("scenarios").select(COLUMNS).eq("id", scenarioId).eq("property_id", propertyId).maybeSingle();
  return data ? hydrate(data) : null;
}
