/** Suburb profile URLs, e.g. /suburbs/nsw/newcastle-2300 (safe to use in client components). */
export const suburbSlug = (suburb: string, postcode: string) => `${suburb.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${postcode}`;
export const suburbHref = (state: string, suburb: string, postcode: string) => `/suburbs/${state.toLowerCase()}/${suburbSlug(suburb, postcode)}`;
