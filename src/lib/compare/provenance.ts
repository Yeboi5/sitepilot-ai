import type { ValueSource } from "./engine";

/**
 * Evidence status for a figure (brief §9): Verified (authoritative record), Reported (listing,
 * agent, provider or you), Estimated (modelled), Unverified (not confirmed). Until licensed and
 * official sources are connected, nothing in Compare is Verified.
 */
export type EvidenceStatus = "verified" | "reported" | "estimated" | "unverified";

export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  verified: "Verified",
  reported: "Reported",
  estimated: "Estimated",
  unverified: "Unverified",
};

export function sourceStatus(source: ValueSource | null, isDemo: boolean): { status: EvidenceStatus; note: string } | null {
  if (!source) return null;
  const demo = isDemo ? " (DEMO)" : "";
  if (source === "listing") return { status: "reported", note: `Reported by the listing${demo}` };
  if (source === "estimate") return { status: "estimated", note: `Automated estimate${demo}` };
  return { status: "unverified", note: "Your figure" };
}

/** Plain-language confidence from the share of key data available. */
export function confidenceLevel(completeness: number): { label: "High" | "Medium" | "Low"; tone: "good" | "fair" | "poor" } {
  if (completeness >= 0.8) return { label: "High", tone: "good" };
  if (completeness >= 0.6) return { label: "Medium", tone: "fair" };
  return { label: "Low", tone: "poor" };
}

/** Price per square metre of land; unknown for apartments (no land area) or missing data. */
export function pricePerSqm(price: number | null, landAreaSqm: number | null, propertyType: string): number | null {
  if (!price || !landAreaSqm || landAreaSqm <= 0 || propertyType === "apartment") return null;
  return Math.round(price / landAreaSqm);
}
