/**
 * Australian states and territories (Master Blueprint v2.0: nationwide).
 *
 * Postcode ranges follow Australia Post's allocation by state, including PO-box ranges.
 * A handful of border postcodes are served across a state line; this check is a sanity check
 * for data entry, not an address validation service (that needs a licensed provider, see L2).
 */
export const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
export type State = (typeof STATES)[number];

type Range = readonly [number, number];

export const STATE_INFO: Record<State, { name: string; timeZone: string; postcodes: readonly Range[] }> = {
  NSW: { name: "New South Wales", timeZone: "Australia/Sydney", postcodes: [[1000, 1999], [2000, 2599], [2619, 2899], [2921, 2999]] },
  ACT: { name: "Australian Capital Territory", timeZone: "Australia/Sydney", postcodes: [[200, 299], [2600, 2618], [2900, 2920]] },
  VIC: { name: "Victoria", timeZone: "Australia/Melbourne", postcodes: [[3000, 3999], [8000, 8999]] },
  QLD: { name: "Queensland", timeZone: "Australia/Brisbane", postcodes: [[4000, 4999], [9000, 9999]] },
  SA: { name: "South Australia", timeZone: "Australia/Adelaide", postcodes: [[5000, 5999]] },
  WA: { name: "Western Australia", timeZone: "Australia/Perth", postcodes: [[6000, 6999]] },
  TAS: { name: "Tasmania", timeZone: "Australia/Hobart", postcodes: [[7000, 7999]] },
  NT: { name: "Northern Territory", timeZone: "Australia/Darwin", postcodes: [[800, 999]] },
};

export function isState(value: unknown): value is State {
  return typeof value === "string" && (STATES as readonly string[]).includes(value);
}

export function isPostcodeInState(state: State, postcode: string): boolean {
  if (!/^\d{4}$/.test(postcode)) return false;
  const n = Number(postcode);
  return STATE_INFO[state].postcodes.some(([lo, hi]) => n >= lo && n <= hi);
}

/** Broken Hill (NSW 2880) keeps South Australian time. */
const POSTCODE_TIME_ZONES: Record<string, string> = { "2880": "Australia/Broken_Hill" };

/** IANA time zone for a property, from its state (and postcode for known exceptions). */
export function timeZoneFor(state: State, postcode?: string | null): string {
  return (postcode && POSTCODE_TIME_ZONES[postcode]) || STATE_INFO[state].timeZone;
}
