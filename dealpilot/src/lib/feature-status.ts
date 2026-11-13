import type { Provenance } from "./domain/types";

export interface FeatureStatus {
  area: string;
  feature: string;
  status: Provenance;
  note: string;
}

/** Single source of truth for what is live, simulated or future. Rendered at /roadmap. */
export const FEATURE_STATUS: FeatureStatus[] = [
  { area: "Accounts", feature: "Sign-up, sign-in, signed sessions, role-based access", status: "live", note: "scrypt passwords, HMAC-signed httpOnly cookies, customer/business/admin roles enforced in every service." },
  { area: "Accounts", feature: "Supabase Auth & Postgres persistence", status: "future", note: "Schema, RLS and storage policies ship in supabase/migrations; DATA_DRIVER=supabase driver is implemented but not yet exercised end-to-end." },
  { area: "Documents", feature: "Private upload of quotes, bills, receipts and contracts", status: "live", note: "Type and magic-byte checks, 8 MB limit, owner-only download route." },
  { area: "Documents", feature: "AI document analysis", status: "live", note: "Anthropic provider when AI_PROVIDER=anthropic; otherwise an offline extractor reads text files. Labelled with the provider used." },
  { area: "Documents", feature: "Market benchmark ranges", status: "simulated", note: "Category benchmark ranges are illustrative until a licensed price dataset is connected." },
  { area: "Marketplace", feature: "Purchase requests with category-specific fields", status: "live", note: "Ten categories configured in one registry; add more without code changes elsewhere." },
  { area: "Marketplace", feature: "Business quotes, AI-drafted bids, human approval", status: "live", note: "AI drafts are saved privately; only a business user's explicit approval publishes an offer." },
  { area: "Marketplace", feature: "Offers from fictional providers", status: "simulated", note: "Generated on request to demonstrate comparisons. Always labelled Simulated." },
  { area: "Marketplace", feature: "Verified reviews", status: "future", note: "Ratings show only when tied to verified DealPilot transactions." },
  { area: "Negotiation", feature: "State machine, recommendations, Advisory & Approval modes", status: "live", note: "Deterministic money decisions; AI writes wording only. Every action audit-logged." },
  { area: "Negotiation", feature: "On-platform negotiation with registered businesses", status: "live", note: "Customers and businesses exchange counteroffers in DealPilot; businesses never see the customer's target or AI notes." },
  { area: "Negotiation", feature: "Negotiation with external providers (telcos, energy, insurers)", status: "simulated", note: "Counterparty replies are simulated. Real negotiation needs authorised provider integrations." },
  { area: "Negotiation", feature: "Limited Autopilot", status: "future", note: "Spending limits, target-price guard and audit log work; restricted to simulated counterparties." },
  { area: "Group buying", feature: "Groups, eligibility, tiers, business volume offers", status: "live", note: "Joining, tier unlocks, notifications and take-up all work." },
  { area: "Group buying", feature: "Seeded groups and placeholder members", status: "simulated", note: "Demo groups include clearly labelled simulated members." },
  { area: "Monitoring", feature: "Manual price, bill, renewal and contract tracking with alerts", status: "live", note: "Alert rules for drops, adjustment windows, targets, bill increases and renewals." },
  { area: "Monitoring", feature: "Automatic retailer price feed", status: "simulated", note: "Simulated feed button. Production will use approved retailer/affiliate APIs only — no scraping." },
  { area: "Money Guardian", feature: "CSV/manual expense analysis", status: "live", note: "Duplicates, subscriptions and price creep. Never asks for bank passwords or moves money." },
  { area: "Money Guardian", feature: "Read-only bank data (Consumer Data Right)", status: "future", note: "Via an accredited CDR intermediary with explicit consent." },
  { area: "Revenue", feature: "Savings calculation, verification, transaction ledger", status: "live", note: "Integer-cent maths, append-only idempotent ledger, savings recalculated from the final invoice." },
  { area: "Revenue", feature: "AUD $1.50 success fee", status: "simulated", note: "Calculated and recorded, never actually charged. Fee capped at the amount saved; no fee without a verified saving." },
  { area: "Revenue", feature: "Payments (Stripe), provider commissions, enterprise partnerships", status: "future", note: "Ledger already supports commission entries." },
];
