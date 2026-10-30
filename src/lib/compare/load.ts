import "server-only";
import { LISTING_COLUMNS } from "@/lib/discovery/types";
import type { createClient } from "@/lib/supabase/server";
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
  const byId = new Map(rows.map((l) => [l.id, l]));
  return ids
    .map((id) => byId.get(id))
    .filter((l): l is CompareListing => !!l)
    .map((l) => factsFor(l, l.property_record_id ? (estimateFor.get(l.property_record_id) ?? null) : null, presetFor.get(l.state) ?? null));
}
