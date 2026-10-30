import "server-only";
import { LISTING_COLUMNS } from "@/lib/discovery/types";
import type { createClient } from "@/lib/supabase/server";
import { assessDevelopment, type DevelopmentStatus } from "./development";
import { factsFor, type CompareListing, type CompareProperty, type DutyPreset, type Estimate } from "./facts";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const MAX_COMPARE = 5;
export const MIN_COMPARE = 2;

/** Parses `?ids=a,b,c`: unique UUIDs, at most five, in the user's order. */
export function parseIds(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return [...new Set(text.split(",").map((s) => s.trim().toLowerCase()).filter((s) => re.test(s)))].slice(0, MAX_COMPARE);
}

/**
 * Loads listings (RLS: DEMO rows for everyone), their latest estimates and the duty presets for
 * their states (reviewed first, then newest). Order follows `ids`; unknown ids are dropped.
 */
export async function loadCompareProperties(supabase: Supabase, ids: string[]): Promise<CompareProperty[]> {
  if (!ids.length) return [];
  const { data: listings } = await supabase.from("listings").select(`${LISTING_COLUMNS}, property_record_id`).in("id", ids);
  const rows = (listings ?? []) as CompareListing[];
  const records = rows.map((l) => l.property_record_id).filter((x): x is string => !!x);
  const states = [...new Set(rows.map((l) => l.state))];
  const [{ data: estimates }, { data: presets }] = await Promise.all([
    records.length
      ? supabase
          .from("property_estimates")
          .select("property_record_id, value_low, value_mid, value_high, rent_weekly_low, rent_weekly_mid, rent_weekly_high, confidence, source, as_of, is_demo")
          .in("property_record_id", records)
          .order("as_of", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("duty_presets").select("state, version, brackets, source_url, as_of, status").in("state", states).order("as_of", { ascending: false }),
  ]);
  const estimateFor = new Map<string, Estimate>();
  for (const e of estimates ?? []) if (!estimateFor.has(e.property_record_id)) estimateFor.set(e.property_record_id, e);
  const presetFor = new Map<string, DutyPreset>();
  for (const p of [...(presets ?? [])].sort((a, b) => Number(b.status === "reviewed") - Number(a.status === "reviewed"))) {
    if (!presetFor.has(p.state)) presetFor.set(p.state, p);
  }
  const developmentFor = await loadDevelopment(supabase, records);
  const byId = new Map(rows.map((l) => [l.id, l]));
  return ids
    .map((id) => byId.get(id))
    .filter((l): l is CompareListing => !!l)
    .map((l) =>
      factsFor(
        l,
        l.property_record_id ? (estimateFor.get(l.property_record_id) ?? null) : null,
        presetFor.get(l.state) ?? null,
        l.property_record_id ? (developmentFor.get(l.property_record_id) ?? null) : null,
      ),
    );
}

/**
 * The viewer's workspaces linked to these property records (RLS decides which they can read;
 * guests can read none), with their evidence and scenarios. The most recently updated workspace
 * per record wins.
 */
async function loadDevelopment(supabase: Supabase, records: string[]): Promise<Map<string, DevelopmentStatus>> {
  const out = new Map<string, DevelopmentStatus>();
  if (!records.length) return out;
  const { data: workspaces } = await supabase
    .from("properties")
    .select("id, property_record_id, updated_at")
    .in("property_record_id", records)
    .order("updated_at", { ascending: false });
  const chosen = new Map<string, string>();
  for (const w of workspaces ?? []) if (w.property_record_id && !chosen.has(w.property_record_id)) chosen.set(w.property_record_id, w.id);
  const ids = [...chosen.values()];
  if (!ids.length) return out;
  const [{ data: evidence }, { data: scenarios }] = await Promise.all([
    supabase.from("evidence").select("property_id, source_type, verification_status, is_demo").in("property_id", ids),
    supabase.from("scenarios").select("id, property_id, name, assumptions_json, updated_at").in("property_id", ids),
  ]);
  for (const [record, ws] of chosen) {
    out.set(
      record,
      assessDevelopment(
        ws,
        (evidence ?? []).filter((e) => e.property_id === ws),
        (scenarios ?? []).filter((s) => s.property_id === ws),
      ),
    );
  }
  return out;
}

/** The signed-in user's saved listings, for adding to a comparison (RLS: own rows only). */
export async function loadSavedOptions(supabase: Supabase) {
  const { data } = await supabase
    .from("saved_properties")
    .select("created_at, listing:listings!inner(id, headline, suburb, state)")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((r) => r.listing as unknown as { id: string; headline: string; suburb: string; state: string });
}
