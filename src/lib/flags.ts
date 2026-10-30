/**
 * Feature flags (Update Pack 1.1). A flag is on only when its env var is exactly "on", so
 * unfinished features stay hidden in production unless deliberately enabled. Flags only hide
 * navigation and routes. Data security never depends on them (RLS does that).
 *
 * NEXT_PUBLIC_* values are inlined at build time.
 */
export const FLAGS = {
  discovery: process.env.NEXT_PUBLIC_FLAG_DISCOVERY === "on",
  couples: process.env.NEXT_PUBLIC_FLAG_COUPLES === "on",
  alerts: process.env.NEXT_PUBLIC_FLAG_ALERTS === "on",
  findAPro: process.env.NEXT_PUBLIC_FLAG_FIND_A_PRO === "on",
} as const;

export type Flag = keyof typeof FLAGS;

export function isEnabled(flag: Flag): boolean {
  return FLAGS[flag];
}
