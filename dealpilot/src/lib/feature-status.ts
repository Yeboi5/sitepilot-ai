import type { Provenance } from "./domain/types";

export interface FeatureStatus {
  area: string;
  feature: string;
  status: Provenance;
  note: string;
}

/**
 * Single source of truth for what is live, simulated or future. Rendered at /roadmap.
 * "Live" means working on real platform data and tested against the real service where one is
 * involved; it does not mean production-ready (see docs/HANDOFF.md and docs/LEGAL_REVIEW.md).
 */
export const FEATURE_STATUS: FeatureStatus[] = [
  { area: "Accounts", feature: "Supabase Auth: sign-up with email confirmation, sign-in, httpOnly sessions", status: "live", note: "Tested against a local Supabase stack (same Auth service). A hosted staging project needs credentials." },
  { area: "Accounts", feature: "Two-step verification (TOTP), mandatory for administrators", status: "live", note: "Enrolment and AAL2 enforcement tested with real codes." },
  { area: "Accounts", feature: "Role-based access and row-level security", status: "live", note: "Service-layer checks plus RLS, tested with real user tokens." },
  { area: "Accounts", feature: "Privacy: data export and account deletion", status: "live", note: "Deletion anonymises the account, blocks sign-in and keeps legally required financial records." },
  { area: "Documents", feature: "Private upload with malware scanning", status: "live", note: "ClamAV (tested against a real daemon); uploads fail closed in production without antivirus." },
  { area: "Documents", feature: "AI extraction with customer review and correction", status: "live", note: "Only customer-confirmed values are used. External AI only with consent." },
  { area: "Documents", feature: "Market benchmark ranges", status: "simulated", note: "Illustrative until a licensed price dataset is connected." },
  { area: "Marketplace", feature: "Requests, verified-business offers, AI-drafted bids with human approval", status: "live", note: "Only administrator-verified businesses with current credentials can submit genuine offers." },
  { area: "Marketplace", feature: "Offers from fictional providers", status: "simulated", note: "Generated on request for demonstrations. Always labelled." },
  { area: "Marketplace", feature: "Reviews from verified jobs only", status: "live", note: "One review per verified, real transaction; enforced in the database." },
  { area: "Business verification", feature: "ABN checksum, administrator ABN confirmation, credential review with evidence and expiry, suspension", status: "live", note: "Nothing a business uploads verifies it by itself." },
  { area: "Business verification", feature: "Automatic ABN Lookup (ABR web service)", status: "future", note: "Client built and parsing tested; needs an ABR GUID to run live." },
  { area: "Business verification", feature: "Automatic licence register checks", status: "future", note: "State registers need agreements/keys; administrators check evidence meanwhile." },
  { area: "Negotiation", feature: "State machine, Advisory & Approval modes, on-platform negotiation", status: "live", note: "Optimistic concurrency; every action audit-logged." },
  { area: "Negotiation", feature: "Both parties approve final terms", status: "live", note: "No deal is agreed until the customer and business (or a recorded exemption) approve." },
  { area: "Negotiation", feature: "Negotiation with external providers (telcos, insurers, retailers)", status: "simulated", note: "Replies are simulated until authorised provider integrations exist." },
  { area: "Negotiation", feature: "Limited Autopilot", status: "future", note: "Limits and audit work; simulated counterparties only; never approves final terms or moves money." },
  { area: "Group buying", feature: "Groups, eligibility, tiers, business volume offers, take-up", status: "live", note: "No deposits or binding commitments." },
  { area: "Group buying", feature: "Seeded groups and placeholder members", status: "simulated", note: "Demo groups include labelled placeholder members." },
  { area: "Monitoring", feature: "Manual price, bill, renewal and contract tracking with alerts", status: "live", note: "No scraping." },
  { area: "Monitoring", feature: "Electricity plan comparison from Energy Made Easy (AER) CDR data", status: "live", note: "Real government data; single-rate tariffs costed as labelled estimates incl. GST." },
  { area: "Monitoring", feature: "Automatic retail price feed", status: "simulated", note: "Production will use approved retailer/affiliate APIs." },
  { area: "Money Guardian", feature: "CSV/manual expense analysis", status: "live", note: "Never asks for bank passwords or moves money." },
  { area: "Money Guardian", feature: "Read-only bank data (Consumer Data Right)", status: "future", note: "Via an accredited intermediary with explicit consent." },
  { area: "Notifications", feature: "Email notifications (SMTP)", status: "live", note: "Tested via SMTP; production needs an email provider account." },
  { area: "Revenue", feature: "Savings verification, realised vs projected savings, atomic idempotent ledger", status: "live", note: "Concurrent verifications can never assess two fees." },
  { area: "Revenue", feature: "AUD $1.50 success fee", status: "simulated", note: "Assessed once per verified, qualifying saving (capped at the saving) — never charged. Payments are disabled." },
  { area: "Revenue", feature: "Payments, provider commissions, enterprise partnerships", status: "future", note: "Require explicit approval; commissions must be disclosed and must not affect rankings." },
];
