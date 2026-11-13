# Roadmap: prototype vs production

The live/simulated/future status of every feature is also shown in the app at `/roadmap`
(source: `src/lib/feature-status.ts`).

## Now: prototype (this release)

| Area | Live | Simulated | Future |
| --- | --- | --- | --- |
| Accounts | Sign-up/in, signed sessions, customer/business/admin roles | — | Supabase Auth, email verification, MFA |
| Documents | Private upload, type/magic-byte checks, AI analysis (Anthropic or offline) | Benchmark price ranges | Licensed price datasets, OCR for scanned offline files |
| Marketplace | Requests with category fields, business offers, AI-drafted bids with human approval, multi-criteria comparison | Fictional bidders | ABN/licence/insurance verification, verified reviews |
| Negotiation | State machine, Advisory & Approval modes, on-platform business negotiation, audit log | External provider replies | Authorised provider integrations; Limited Autopilot with real counterparties |
| Group buying | Groups, eligibility, tiers, volume offers, take-up | Seeded groups & placeholder members | Group formation by matching, escrowed commitments |
| Monitoring | Manual tracking, alert rules (drops, adjustment windows, targets, bill increases, renewals) | Price feed | Approved retailer/affiliate price APIs (no scraping) |
| Money Guardian | CSV/manual analysis: duplicates, subscriptions, price creep | — | Read-only Consumer Data Right via an accredited intermediary |
| Revenue | Savings maths, verification, append-only idempotent ledger | $1.50 fee (recorded, never charged) | Stripe payments, provider commissions, enterprise partnerships |

## Next: make each feature operational

1. **Supabase end-to-end.** Run the full journey suite against a staging project with
   `DATA_DRIVER=supabase`; move multi-row writes (agreement → transaction → ledger) into Postgres
   functions so they're atomic; switch to Supabase Auth.
2. **Payments.** Stripe for the success fee, charged only on `saving_verified`, using the existing
   ledger idempotency keys. Refund flow. Clear fee disclosure before every acceptance.
3. **Business trust.** ABN lookup, state licence registers, insurance certificate upload and expiry
   tracking; reviews only from verified DealPilot transactions.
4. **Real data sources.** Energy: government plan-comparison data. Telco/retail: partner and
   affiliate APIs. Banking: CDR. Each behind the existing provider interfaces.
5. **Provider integrations for negotiation.** Start with partners who accept structured retention
   requests; Limited Autopilot enabled per partner with spending limits and audit trails.
6. **Notifications.** Email/SMS/push for alerts and counteroffers; scheduled monitoring checks.

## Production gates (must be done before real customers)

- Real authentication with verification and MFA; account recovery; rate limiting and bot protection.
- Upload malware scanning; retention and deletion policy for documents; privacy policy (APPs).
- Payments with PCI-compliant provider; tax invoices for fees.
- Legal review: consumer law (no misleading savings claims), fee disclosure, AI-agent terms,
  insurance/financial-product boundaries (general information only).
- Observability (error tracking, audit export), backups, incident response.
- Accessibility audit (WCAG 2.2 AA) and load testing.
