import { APP_TIME_ZONE } from "@/lib/dates";
import type { BadgeTone } from "@/components/ui";
import type { Enums } from "@/lib/supabase/database.types";

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE });

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00+10:00` : value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export const EVIDENCE_STATUS: Record<Enums<"evidence_status">, { label: string; tone: BadgeTone }> = {
  unverified: { label: "Unverified", tone: "warning" },
  verified: { label: "Verified against source", tone: "success" },
  disputed: { label: "Disputed", tone: "danger" },
  superseded: { label: "Superseded", tone: "neutral" },
};

export const MATTER_STATUS: Record<Enums<"matter_status">, { label: string; tone: BadgeTone }> = {
  invited: { label: "Invitation pending", tone: "info" },
  active: { label: "Active", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  revoked: { label: "Access revoked", tone: "danger" },
  closed: { label: "Closed", tone: "neutral" },
};

export const FINDING_STATUS: Record<Enums<"finding_status">, { label: string; tone: BadgeTone }> = {
  unreviewed: { label: "AI flag · unreviewed", tone: "warning" },
  needs_clarification: { label: "Needs clarification", tone: "info" },
  confirmed: { label: "Confirmed by professional", tone: "success" },
  rejected: { label: "Rejected", tone: "neutral" },
};

export const ORG_VERIFICATION: Record<Enums<"verification_status">, { label: string; tone: BadgeTone }> = {
  unverified: { label: "Unverified", tone: "neutral" },
  pending: { label: "Verification pending", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  rejected: { label: "Verification rejected", tone: "danger" },
};

export const PLAN_LABEL: Record<Enums<"plan_tier">, string> = {
  explorer: "Explorer",
  investor_pro: "Investor Pro",
  developer: "Developer",
  conveyancer: "Conveyancer",
};

const audFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

/** Whole-dollar AUD with a true minus sign for negatives. */
export function formatAud(value: number): string {
  return audFmt.format(Math.round(value)).replace("-", "−");
}

/**
 * Compact AUD ("$1.3M", "−$25K"). Formatted by hand because ICU builds differ (Node prints
 * "$25.0K" where browsers print "$25K"), which breaks hydration of server-rendered charts.
 */
export function formatAudCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Signed change, e.g. "+$12,000" / "−$4,500". */
export function formatAudDelta(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "$0";
  return `${rounded > 0 ? "+" : ""}${formatAud(rounded)}`;
}

/** Ratio (0.1234) as a percentage ("12.3%"), or "n/a" when undefined. */
export function formatRatio(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "n/a";
  return `${(value * 100).toFixed(digits)}%`.replace("-", "−");
}
