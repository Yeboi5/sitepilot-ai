/**
 * Normalise a free-text address query into safe search terms. Only letters, digits and single
 * spaces survive, so the text can't inject PostgREST filter syntax (commas, parentheses, dots).
 */
export function normaliseQuery(q: string): string {
  return q
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
