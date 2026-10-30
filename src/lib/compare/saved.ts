import "server-only";
import { createClient } from "@/lib/supabase/server";
import { compareStateSchema, initialState, type CompareState } from "./state";

/** Reads a saved comparison (RLS: owner only). Invalid stored JSON falls back to defaults. */
export async function loadSavedState(setId: string): Promise<(CompareState & { sharedAt: string | null }) | null> {
  const supabase = await createClient();
  const [{ data: set }, { data: items }, { data: assumptions }] = await Promise.all([
    supabase.from("comparison_sets").select("id, name, mode, shared_at").eq("id", setId).maybeSingle(),
    supabase.from("comparison_items").select("listing_id, overrides_json, sort_order").eq("comparison_set_id", setId).order("sort_order"),
    supabase.from("comparison_assumptions").select("assumptions_json, weights_json").eq("comparison_set_id", setId).maybeSingle(),
  ]);
  if (!set) return null;
  const listingIds = (items ?? []).map((i) => i.listing_id).filter((x): x is string => !!x);
  const base = initialState(listingIds, set.mode);
  const candidate = {
    ...base,
    name: set.name,
    assumptions: assumptions?.assumptions_json ?? base.assumptions,
    weights: assumptions?.weights_json ?? base.weights,
    overrides: Object.fromEntries((items ?? []).filter((i) => i.listing_id).map((i) => [i.listing_id!, i.overrides_json])),
  };
  const parsed = compareStateSchema.safeParse(candidate);
  const state = parsed.success ? parsed.data : { ...base, name: set.name };
  return { ...state, sharedAt: set.shared_at };
}
