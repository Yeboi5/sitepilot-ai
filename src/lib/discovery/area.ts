/**
 * Area search for Discover: one or more towns, suburbs or postcodes, comma-separated
 * ("Newcastle, 2300, Wollongong NSW"). Matching is exact (case-insensitive) on the suburb name or
 * the postcode. There's no "nearby" yet: that needs licensed address and boundary data (G-NAF).
 */
export const MAX_AREAS = 5;
const STATE_SUFFIX = /\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)(\s+\d{4})?$/i;

export type AreaQuery = { suburbs: string[]; postcodes: string[]; labels: string[] };

export function parseAreas(raw: string | undefined | null): AreaQuery {
  const out: AreaQuery = { suburbs: [], postcodes: [], labels: [] };
  for (const part of (raw ?? "").split(",").slice(0, MAX_AREAS * 2)) {
    const text = part
      .replace(/[^A-Za-z0-9 '\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    if (!text) continue;
    if (/^\d{4}$/.test(text)) {
      if (!out.postcodes.includes(text)) out.postcodes.push(text);
    } else {
      // "Newcastle NSW 2300" from the suggestions list: keep the suburb name.
      const suburb = text.replace(STATE_SUFFIX, "").trim();
      if (suburb && !out.suburbs.some((s) => s.toLowerCase() === suburb.toLowerCase())) out.suburbs.push(suburb);
    }
    if (out.suburbs.length + out.postcodes.length >= MAX_AREAS) break;
  }
  out.labels = [...out.suburbs, ...out.postcodes];
  return out;
}

/** PostgREST `or` filter (values double-quoted; input is already restricted to safe characters). */
export function areaFilter(q: AreaQuery): string | null {
  const parts = [...q.suburbs.map((s) => `suburb.ilike."${s.replace(/"/g, "")}"`), ...q.postcodes.map((p) => `postcode.eq.${p}`)];
  return parts.length ? parts.join(",") : null;
}
