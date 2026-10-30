/**
 * Indicative investment signals shown on demo cards. Deterministic and labelled: the rent is an
 * assumption (demo data), so the yield is too. Fuller cash-flow modelling uses the feasibility
 * engine (V2-6).
 */
export const SIGNALS_VERSION = "signals-1.0.0";

/** Gross yield = weekly rent × 52 ÷ price. Null when either input is missing or zero. */
export function grossYield(askingPrice: number | null | undefined, weeklyRent: number | null | undefined): number | null {
  if (!askingPrice || !weeklyRent || askingPrice <= 0 || weeklyRent <= 0) return null;
  return Math.round(((weeklyRent * 52) / askingPrice) * 1e6) / 1e6;
}
