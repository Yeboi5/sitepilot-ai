import { timeZoneFor, type State } from "./jurisdictions";

/**
 * Default time zone for platform-level timestamps (audit log, report generation time).
 * Property-specific "today" uses the property's own time zone: see dateForProperty().
 */
export const APP_TIME_ZONE = "Australia/Sydney";

/** Calendar date (YYYY-MM-DD) in a given IANA time zone. */
export function localDate(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
}

/** Calendar date in Sydney. */
export function sydneyDate(at: Date = new Date()): string {
  return localDate(APP_TIME_ZONE, at);
}

/** "Today" where the property is (e.g. Perth is 2–3 hours behind Sydney). */
export function dateForProperty(property: { jurisdiction: string; postcode: string | null }, at: Date = new Date()): string {
  return localDate(timeZoneFor(property.jurisdiction as State, property.postcode), at);
}
