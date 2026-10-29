/** NSW is the only pilot jurisdiction, so "today" means the calendar date in Sydney. */
export const APP_TIME_ZONE = "Australia/Sydney";

/** Calendar date (YYYY-MM-DD) in Sydney for the given instant. */
export function sydneyDate(at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(at);
}
