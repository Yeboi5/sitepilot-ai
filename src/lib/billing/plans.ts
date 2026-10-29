import type { Enums } from "@/lib/supabase/database.types";

/**
 * Hypothesis pricing from the MVP blueprint (AUD, GST treatment TBC). These are display
 * values only — Stripe sandbox products are wired up in Sprint 5 and no real payments are
 * taken until terms and compliance are ready.
 */
export type Plan = {
  tier: Enums<"plan_tier">;
  name: string;
  audience: "investor" | "professional";
  monthlyAud: number;
  pricingNote?: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    tier: "explorer",
    name: "Explorer",
    audience: "investor",
    monthlyAud: 0,
    features: ["1 property workspace", "Manual planning evidence register", "Basic feasibility scenario"],
  },
  {
    tier: "investor_pro",
    name: "Investor Pro",
    audience: "investor",
    monthlyAud: 79,
    features: ["Unlimited property workspaces", "Scenario comparison & sensitivity", "Invite a conveyancer", "Included document processing quota"],
  },
  {
    tier: "developer",
    name: "Developer",
    audience: "investor",
    monthlyAud: 299,
    features: ["Everything in Investor Pro", "Team members", "Due-diligence report export", "Higher document processing quota"],
  },
  {
    tier: "conveyancer",
    name: "Conveyancer",
    audience: "professional",
    monthlyAud: 249,
    pricingNote: "per firm",
    features: ["Matter inbox & review queue", "Verify AI-extracted issues with source pages", "Tasks, milestones & audit trail"],
  },
];

export const METERING_NOTE = "Document processing is metered after the included quota.";
