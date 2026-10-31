import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { buildTypeProfile, snapshotFrom, type DwellingType, type RentPoint, type SalesPoint, type SuburbSnapshot, type TypeProfile } from "./stats";

type Supabase = Awaited<ReturnType<typeof createClient>>;

import { buildOfficialProfile, officialSnapshot, type OfficialProfile, type OfficialRow } from "@/lib/official/postcode";
import { suburbSlug } from "./links";

export { suburbHref, suburbSlug } from "./links";

export type SuburbProfile = {
  suburb: string;
  state: string;
  postcode: string;
  profiles: Record<DwellingType, TypeProfile>;
  source: { name: string; status: string; retrievedAt: string; isDemo: boolean; url: string | null };
  others: { suburb: string; postcode: string }[];
};

/** Resolves `/suburbs/nsw/newcastle-2300` and loads its statistics (public aggregate data). */
export async function loadSuburbProfile(supabase: Supabase, stateParam: string, slug: string): Promise<SuburbProfile | null> {
  const state = stateParam.toUpperCase();
  const m = /^([a-z0-9-]+)-(\d{4})$/.exec(slug);
  if (!m || !/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/.test(state)) return null;
  const postcode = m[2]!;
  const { data: candidates } = await supabase
    .from("suburb_sales_stats")
    .select("suburb")
    .eq("state", state)
    .eq("postcode", postcode)
    .is("bedrooms", null)
    .limit(500);
  const suburb = [...new Set((candidates ?? []).map((c) => c.suburb))].find((s) => suburbSlug(s, postcode) === slug);
  if (!suburb) return null;

  const [{ data: sales }, { data: rents }, { data: others }] = await Promise.all([
    supabase
      .from("suburb_sales_stats")
      .select("dwelling_type, bedrooms, period_end, median_price, sales_count, source, source_url, retrieved_at, status, is_demo")
      .eq("state", state)
      .eq("postcode", postcode)
      .eq("suburb", suburb)
      .eq("window_months", 12)
      .order("period_end"),
    supabase.from("suburb_rent_stats").select("dwelling_type, bedrooms, period_end, median_rent_weekly, bonds_count").eq("state", state).eq("postcode", postcode).eq("suburb", suburb).is("bedrooms", null).order("period_end"),
    supabase.from("suburb_sales_stats").select("suburb, postcode").eq("state", state).is("bedrooms", null).eq("dwelling_type", "house").neq("suburb", suburb).limit(2000),
  ]);
  if (!sales?.length) return null;

  const latestPeriod = sales.reduce((a, b) => (b.period_end > a ? b.period_end : a), "");
  const build = (type: DwellingType) => {
    const series: SalesPoint[] = sales.filter((r) => r.dwelling_type === type && r.bedrooms == null).map((r) => ({ periodEnd: r.period_end, median: r.median_price, count: r.sales_count }));
    const rent: RentPoint[] = (rents ?? []).filter((r) => r.dwelling_type === type).map((r) => ({ periodEnd: r.period_end, medianWeekly: r.median_rent_weekly, count: r.bonds_count }));
    const beds = sales
      .filter((r) => r.dwelling_type === type && r.bedrooms != null && r.period_end === latestPeriod)
      .map((r) => ({ bedrooms: r.bedrooms!, median: r.median_price, count: r.sales_count }));
    return buildTypeProfile(type, series, rent, beds);
  };
  const first = sales[0]!;
  return {
    suburb,
    state,
    postcode,
    profiles: { house: build("house"), unit: build("unit") },
    source: { name: first.source, status: first.status, retrievedAt: first.retrieved_at, isDemo: sales.some((s) => s.is_demo), url: first.source_url },
    others: [...new Map((others ?? []).map((o) => [`${o.suburb}-${o.postcode}`, o])).values()].sort((a, b) => a.suburb.localeCompare(b.suburb)),
  };
}

/** Every suburb with statistics, for the index and search suggestions. */
export async function listSuburbs(supabase: Supabase) {
  const { data } = await supabase.from("suburb_sales_stats").select("state, suburb, postcode").is("bedrooms", null).eq("dwelling_type", "house").limit(10000);
  return [...new Map((data ?? []).map((r) => [`${r.state}/${r.suburb}/${r.postcode}`, r])).values()].sort((a, b) => a.state.localeCompare(b.state) || a.suburb.localeCompare(b.suburb));
}

/** Which suburb statistics apply to a listing's property type (land has none yet). */
export function dwellingFor(propertyType: string): DwellingType | null {
  if (propertyType === "apartment" || propertyType === "townhouse") return "unit";
  if (propertyType === "house" || propertyType === "duplex") return "house";
  return null;
}

/** Suburb snapshots for the given places, keyed `STATE/Suburb/postcode/type`. */
export async function loadSuburbSnapshots(supabase: Supabase, places: { state: string; suburb: string; postcode: string }[]): Promise<Map<string, SuburbSnapshot>> {
  const out = new Map<string, SuburbSnapshot>();
  const unique = [...new Map(places.map((p) => [`${p.state}/${p.suburb}/${p.postcode}`, p])).values()];
  if (!unique.length) return out;
  const { data } = await supabase
    .from("suburb_sales_stats")
    .select("state, suburb, postcode, dwelling_type, period_end, median_price, sales_count, is_demo")
    .in("postcode", unique.map((p) => p.postcode))
    .in("suburb", unique.map((p) => p.suburb))
    .is("bedrooms", null)
    .eq("window_months", 12)
    .limit(5000);
  const officials = new Map(
    await Promise.all(unique.filter((p) => p.state === "NSW").map(async (p) => [p.postcode, await loadOfficialPostcode(supabase, p.state, p.postcode)] as const)),
  );
  for (const place of unique) {
    for (const type of ["house", "unit"] as const) {
      const official = officials.get(place.postcode);
      const fromOfficial = official ? officialSnapshot(official, type, place) : null;
      if (fromOfficial) {
        out.set(`${place.state}/${place.suburb}/${place.postcode}/${type}`, fromOfficial);
        continue;
      }
      const rows = (data ?? []).filter((r) => r.state === place.state && r.suburb === place.suburb && r.postcode === place.postcode && r.dwelling_type === type);
      if (!rows.length) continue;
      const profile = buildTypeProfile(type, rows.map((r) => ({ periodEnd: r.period_end, median: r.median_price, count: r.sales_count })), [], []);
      out.set(`${place.state}/${place.suburb}/${place.postcode}/${type}`, snapshotFrom(profile, place, rows.some((r) => r.is_demo)));
    }
  }
  return out;
}

/** Official NSW postcode figures (NSW Rent and Sales Report), or null when none are loaded. */
export async function loadOfficialPostcode(supabase: Supabase, state: string, postcode: string): Promise<OfficialProfile | null> {
  if (state !== "NSW" || !/^\d{4}$/.test(postcode)) return null;
  const { data } = await supabase
    .from("official_area_stats")
    .select("dataset, category, dwelling_type, bedrooms, period_start, period_end, median, count, count_note, change_annual, change_quarterly, source_url, retrieved_at")
    .eq("area_type", "postcode")
    .eq("area_code", postcode)
    .in("dwelling_type", ["house", "unit"])
    .order("period_end")
    .limit(2000);
  return buildOfficialProfile(postcode, (data ?? []) as OfficialRow[]);
}
