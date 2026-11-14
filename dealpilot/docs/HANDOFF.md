# DealPilot: Phase 2 handoff ("Real-World Foundation")

*For the product owner and any planning assistant (e.g. ChatGPT). Describes what Phase 2 delivered,
how it was tested, what is still open, which credentials are needed, and the recommended next stage.*

- Code: repository `yeboi5/sitepilot-ai`, branch `claude/dealpilot-platform-oe3fya`, folder `dealpilot/`.
- Audit done before coding: [PHASE2_AUDIT.md](PHASE2_AUDIT.md).
- Nothing was deployed, no real charges were enabled, and no external business was contacted.

## 1. Summary

DealPilot now has a real data foundation: Supabase persistence and Auth (email verification, MFA),
all-or-nothing and concurrency-safe deal, verification and ledger writes, both-party approval of final
terms, a qualifying-fee model, business verification, verified-job reviews, malware scanning, rate
limiting, privacy controls, and one live, compliant data integration (Energy Made Easy).
All modules from Phase 1 are preserved, and all six demo journeys still pass on both the in-memory
demo and real Supabase persistence.

**Testing caveat:** every Supabase feature was tested against a **local Supabase stack** (the same
Postgres, Auth, REST and Storage services a hosted project runs), not a hosted staging project, because
no staging credentials were provided. Nothing should be called production-ready until the suites below
pass against hosted staging.

## 2. Product decisions implemented

| Decision | How it's implemented |
| --- | --- |
| Free customer registration | Unchanged; sign-up is free |
| $1.50 once per completed, verified, qualifying saving, capped | `assessFee()`: verified + saving > 0 + real counterparty → `min($1.50, saving)`; one `fee_assessed` ledger entry per transaction (unique key); simulated deals never qualify |
| Recurring savings monthly + projected annual; realised vs projected | Dashboard and savings page show Realised (verified), Recurring/month, Projected 12 months, Pending — separately |
| Businesses free during launch | No business fees; transactions page says so |
| No deposits or binding group commitments | Group take-up records a deal only; nothing is collected |
| Australia first, configurable markets | `MARKET` (AU/NZ/GB): currency, tax rate, regulator and privacy regime; currency and jurisdiction stored on transactions |
| AI never moves money, signs, or exceeds permission | AI drafts only; Autopilot can propose but never approves final terms; payments disabled; AI only sees user data with consent |
| Commissions disclosed and never affect rankings | Ranking inputs have no payment fields (documented in code); legal review item |

## 3. Completed work by stage

1. **Data foundation.**
   - Phase 2 migration.
   - Profiles are created from Supabase Auth by a trigger; nobody can sign up as an admin.
   - Supabase Auth with httpOnly SSR cookies, email confirmation, and TOTP MFA (mandatory for admins).
   - `Store.atomic` / `apply_batch()`: row-locked, guarded, all-or-nothing writes.
   - Optimistic concurrency on negotiations.
   - Postgres-backed rate limiter.
   - Demo seed with real Auth users.
2. **Workflow corrections.**
   - Customers review and correct AI extraction; only confirmed values are used.
   - Both parties must approve the final terms (with recorded exemptions for simulated counterparties, retailer adjustments and pre-approved group offers).
   - Realised vs projected savings.
   - The comparison shows *verified* credentials, never self-declared ones.
3. **Business verification.**
   - ABN checksum and an ABN Lookup client; manual confirmation by an administrator when ABN Lookup isn't configured.
   - Licence and insurance with evidence and expiry; an administrator must review them.
   - Admin verify/reject/suspend, with blockers.
   - Only verified businesses with current credentials can submit offers or agree deals, enforced in the service and by a database trigger.
   - Reviews only from verified, real jobs, also enforced in the database.
4. **Integrations.**
   - **Live: Energy Made Easy (AER) Consumer Data Right plan data.** Single-rate tariffs are costed for a postcode and usage, labelled as estimates including GST, with eligibility, discounts and controlled load flagged.
   - SMTP email notifications.
   - Pricing-source registry.
   - Payment interface (disabled).
   - Market configuration.
5. **Security and reliability.**
   - Malware scanning before storage: ClamAV, failing closed in production.
   - AI consent for both documents and drafting.
   - Rate limits on sign-in, sign-up, MFA, uploads, AI calls, pricing lookups and exports.
   - Data export and account deletion (anonymised; financial records retained).
   - `/api/health`, structured JSON logs, CSP/HSTS and other security headers.
   - [SECURITY.md](SECURITY.md) (controls, monitoring, backups, incidents) and [LEGAL_REVIEW.md](LEGAL_REVIEW.md).
6. **Regression.** Both drivers, all suites. CI now has an integration job with Supabase and ClamAV.

## 4. Test results (final run)

| Suite | Result | Against |
| --- | --- | --- |
| Type check | Pass | — |
| Unit/workflow (`npm test`) | **68/68** | In-memory store |
| Schema/RLS on plain Postgres (`npm run test:db`) | **24/24** | PostgreSQL 16 with Supabase shim |
| Integration (`npm run test:integration`) | **20/20** | Local Supabase stack (Auth, Postgres 17, Storage, Mailpit), real ClamAV daemon, live Energy Made Easy API |
| Browser journeys (`npm run test:e2e`) — memory driver | **14/14** | Production build |
| Browser journeys — Supabase driver | **14/14** | Production build on local Supabase, incl. admin MFA enrolment through the UI |

Covered explicitly:
- **Persistence:** read-back from a fresh connection.
- **Permissions:** cross-user RLS with real user tokens, anonymous access, role escalation, business redaction, suspended businesses.
- **Negotiation approval:** both parties required; Autopilot can't approve.
- **Fee calculation:** qualifying vs simulated, capped, waived, assessed only.
- **Concurrency:** three simultaneous verifications produce one fee; verify-vs-cancel races; stale writes are rejected.
- **Duplicate transactions:** unique ledger keys; rollback of failed batches.
- **Failed integrations:** energy source down, scanner down (uploads fail closed), SMTP failure (logged, non-fatal), ABN Lookup not configured.

CI workflows were updated but **have not run on GitHub yet** (this environment can't trigger them).

### Bugs found by testing against real services
- The EICAR malware test string in the built-in scanner was wrong. Only the real ClamAV test exposed it; fixed.
- `@supabase/ssr` sets the auth cookie readable by scripts by default; now forced `httpOnly`.

## 5. Unresolved issues and limitations

1. **No hosted staging yet**, so everything Supabase-related is verified locally only.
2. **ABN Lookup** needs a GUID; until then an administrator confirms ABNs manually on abr.business.gov.au.
3. **Licence registers** are not checked automatically (no single national API); administrators review evidence.
4. **Energy estimates** cost single-rate tariffs only. About two-thirds of plans (time-of-use, demand, seasonal) are shown as "not costed".
   - GST treatment assumes CDR prices are GST-exclusive. **Please confirm** (`CDR_PRICES_INCLUDE_GST`).
   - Conditional discounts, solar feed-in and controlled load are excluded.
5. **Negotiation with external providers** (telcos, insurers) remains simulated until authorised integrations exist; it is labelled throughout.
6. **CSP** still allows inline scripts (Next.js); a nonce-based CSP is a follow-up.
7. The Supabase driver's `list()` reads at most 1,000 rows and some filtering happens in the app. Fine for staging; needs paging and indexes for scale.
8. The rate limiter keys on `x-forwarded-for`, so it depends on the host setting it correctly.
9. Account deletion is a sequence of idempotent steps, not one transaction. A retry completes it.
10. Demo staging requires `MFA_REQUIRED_ROLES` admins to enrol an authenticator; this is intentional.

## 6. Credentials and accounts required

| Needed for | What to provide | Where it goes |
| --- | --- | --- |
| **Staging (blocking)** | Supabase project URL, anon/publishable key, service-role key | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| App hosting | Vercel (or other Node host) project | — |
| Email | Transactional email provider with SMTP (Postmark, SES, Resend…) and a sending domain | `SMTP_URL`, `EMAIL_FROM`; also Supabase Auth custom SMTP |
| Malware scanning | A private ClamAV service | `CLAMD_HOST`, `CLAMD_PORT` |
| ABN checks | ABN Lookup web services GUID (free) | `ABR_GUID` |
| AI (optional) | Anthropic API key | `ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic` |
| Later, with approval only | Stripe account (test mode first) | not wired yet |

No secrets are stored in the repository.

## 7. Before public launch

- All suites passing against hosted staging; restore drill completed (see SECURITY.md).
- Legal review items 1–19 in LEGAL_REVIEW.md, especially fee disclosure, savings claims, AI-agent
  authority, privacy policy and overseas disclosure, and energy comparison rules.
- Real email provider, ClamAV with signature updates, monitoring alerts on `/api/health` and logs.
- Administrator MFA enforced; admin accounts created only via SQL.
- Real businesses verified through the admin workflow; demo data never loaded into production.

## 8. Recommended next stage — "Phase 3: staging and closed pilot"

1. Provide staging credentials. Then: run migrations, run `test:integration` and `test:e2e` against
   staging, connect email and ClamAV, add the ABR GUID.
2. Complete the legal review and publish terms, privacy policy and fee disclosure.
3. Closed pilot: one category and region (e.g. fencing in Sydney), a handful of real verified
   businesses, customers you invite. Fees stay assessed-only.
4. Improve energy costing (time-of-use, seasonal, solar) and add a "switch" hand-off.
5. Hardening: nonce-based CSP, dependency scanning, error tracking, Supabase log alerts.
6. Only after pilot results and approval: payments (Stripe), then provider integrations.

## 9. Decisions still needed from the product owner

1. Staging credentials (see section 6), and who will act as the first DealPilot administrator.
2. Confirm the GST assumption for Energy Made Easy prices, and whether to show estimates excluding GST too.
3. Should business accounts also require MFA (`MFA_REQUIRED_ROLES=admin,business`)?
4. Pilot category and region.
5. Email sending domain and support contact address.
