/**
 * Feature flags (Update Pack 1.1 and Master Blueprint v2.0). A flag is on only when its env var
 * is exactly "on", so unfinished features stay hidden unless deliberately enabled. Flags only hide
 * navigation and routes. Data security never depends on them (RLS does that).
 *
 * NEXT_PUBLIC_* values are inlined at build time.
 */
export const FLAGS = {
  discovery: process.env.NEXT_PUBLIC_FLAG_DISCOVERY === "on",
  couples: process.env.NEXT_PUBLIC_FLAG_COUPLES === "on",
  alerts: process.env.NEXT_PUBLIC_FLAG_ALERTS === "on",
  findAPro: process.env.NEXT_PUBLIC_FLAG_FIND_A_PRO === "on",
  // Master Blueprint v2.0
  nationwide: process.env.NEXT_PUBLIC_FLAG_NATIONWIDE === "on",
  myProperty: process.env.NEXT_PUBLIC_FLAG_MY_PROPERTY === "on",
  homeownerClaims: process.env.NEXT_PUBLIC_FLAG_HOMEOWNER_CLAIMS === "on",
  buyerEnquiries: process.env.NEXT_PUBLIC_FLAG_BUYER_ENQUIRIES === "on",
  vision: process.env.NEXT_PUBLIC_FLAG_VISION === "on",
  visionRealProvider: process.env.NEXT_PUBLIC_FLAG_VISION_REAL_PROVIDER === "on",
  matterport: process.env.NEXT_PUBLIC_FLAG_MATTERPORT === "on",
  dutyPresets: process.env.NEXT_PUBLIC_FLAG_DUTY_PRESETS === "on",
} as const;

export type Flag = keyof typeof FLAGS;

export function isEnabled(flag: Flag): boolean {
  return FLAGS[flag];
}
