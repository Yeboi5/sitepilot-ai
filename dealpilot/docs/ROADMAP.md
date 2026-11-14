# Roadmap

Live / simulated / future status of every feature is shown in the app at `/roadmap`
(source: `src/lib/feature-status.ts`).

## Phase 1 — navigable prototype ✅
All modules and six demo journeys on seeded, labelled demo data.

## Phase 2 — real-world foundation ✅ (this release)
Supabase persistence and Auth (email verification, MFA), atomic and concurrency-safe deal,
verification and ledger writes, dual approval of final terms, qualifying-fee model (assessed, not
charged), realised vs projected savings, extraction review, business verification and verified-job
reviews, malware scanning, rate limiting, privacy export/deletion, health and logging, live Energy
Made Easy plan data, SMTP notifications, payment/pricing interfaces.

## Phase 3 — staging and first real users (recommended next)
1. Hosted staging Supabase project; run the integration and e2e suites against it; ClamAV and email
   provider in staging.
2. Legal review items in [LEGAL_REVIEW.md](LEGAL_REVIEW.md), especially fee disclosure, savings claims,
   AI-agent terms and the privacy policy.
3. ABN Lookup GUID; licence-register checks where a state offers an API.
4. Closed pilot with a handful of real verified businesses in one category and region
   (e.g. fencing in Sydney), with customers invited by you.
5. Energy: time-of-use and seasonal tariff costing; solar feed-in; plan switch hand-off to retailers.
6. Nonce-based CSP, dependency scanning, error tracking, Supabase log alerts.

## Later
- Payments (Stripe) for the success fee, only after approval and legal sign-off.
- Authorised provider integrations for real negotiations (telco, energy, insurance).
- Approved retailer/affiliate price APIs for retail monitoring.
- Consumer Data Right banking (read-only) for Money Guardian via an accredited intermediary.
- Disclosed provider commissions and enterprise partnerships (never influencing rankings).
- Multi-market launch using `MARKET` configuration (currency, tax, regulators).
