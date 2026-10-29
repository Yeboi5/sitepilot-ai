import type { BadgeTone } from "@/components/ui";
import type { Enums } from "@/lib/supabase/database.types";

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });

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
