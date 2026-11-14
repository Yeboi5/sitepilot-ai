# Phase 2 audit (before coding)

Audited: `src/`, `supabase/migrations`, `supabase/tests`, `tests/`, `docs/`, CI. Environment
checked: Docker and the Supabase CLI work here, so a **real local Supabase stack** (Postgres 17,
GoTrue Auth, PostgREST, Storage, Mailpit) can be used for integration testing. No staging project
credentials have been provided. The AER's Energy Made Easy Consumer Data Right *Product Reference
Data* API (public, unauthenticated government data) is reachable. The ABN Lookup service is
reachable but needs a free registration GUID.

## 1. What already works

- Layered modular monolith (pages → services → pure domain → adapters) with a `Store` port and two
  drivers (memory, Supabase). Domain rules are pure and unit-tested.
- All product modules: customer and business portals, 10-category registry, negotiation state
  machine with three permission modes, sealed-bid comparison, group buying, monitoring, Money
  Guardian, savings maths, append-only idempotent ledger, audit log, AI provider abstraction
  (mock + Claude with fallback), private document upload with magic-byte checks.
- Supabase schema applies cleanly on real Supabase Postgres 17, with savings/fee CHECK constraints,
  append-only triggers and RLS. 36 unit/workflow tests, 24 DB checks, six e2e journeys pass.

## 2. What needs correction

| # | Issue | Why it matters | Fix |
| --- | --- | --- | --- |
| C1 | Auth is a home-grown cookie session for both drivers; `password_hash` lives in `profiles` | Phase 2 requires Supabase Auth, email verification, MFA | Supabase Auth (SSR cookies) when `DATA_DRIVER=supabase`; profile created by an `auth.users` trigger; TOTP MFA with AAL2 enforcement (mandatory for admins). Demo cookie auth kept only for the memory demo |
| C2 | Multi-row writes (agreement → transaction → ledger → offers; verification → ledger → negotiation) are separate calls | A crash or concurrent request can leave half-written deals or double-verify | `Store.atomic(guards, ops)`: one Postgres function (`apply_batch`) with row locks and guard checks; same semantics in the memory driver |
| C3 | Either side "accepting" immediately creates an agreed deal | Both parties must explicitly approve final terms | New `final_approval` state with recorded customer and business approvals; simulated counterparties auto-approve, labelled |
| C4 | Fee is "charged (simulated)" on any verified saving, including simulated counterparties | Fee must apply only to *qualifying* transactions, once, capped | `qualifiesForFee()` rule (verified, real counterparty or customer-achieved saving, saving > 0); fee **assessed** (owed) but never collected; payments disabled by default |
| C5 | Recurring savings shown only as "12-month" totals labelled "Verified" | Presents a projection as realised money | Show monthly saving and projected annual separately from realised (verified) savings |
| C6 | Business licence/insurance are self-declared but shown as facts; "Registered business" badge; ratings are a stored number | Must not imply verification | Verification model: ABN checksum + ABR lookup, credential evidence with expiry, admin approval/suspension; only admin-verified businesses submit genuine offers; ratings computed only from reviews of verified jobs |
| C7 | AI extraction goes straight into requests | Customer must review and correct extracted data | Review/correct step; requests use customer-confirmed values |
| C8 | No rate limiting, malware scanning, privacy export/deletion, health check, structured logging | Security & reliability requirements | Postgres-backed rate limiter, scanner interface (EICAR baseline + ClamAV `clamd` adapter, fail-closed in production), data export + account deletion (anonymisation), `/api/health`, JSON logs |
| C9 | No notification, payment or pricing-source interfaces | Needed for real integrations | Provider interfaces; SMTP email (tested against local Mailpit); payments interface with a disabled provider; real Energy Made Easy CDR plan integration |
| C10 | Currency/jurisdiction hard-coded to AUD/Australia in places | Must be configurable | Market config (`MARKET`, currency, GST rate, regulator notes) |
| C11 | `list()` in the Supabase driver caps at 1,000 rows and filters in memory for some queries | Scale | Documented; acceptable for staging, flagged in roadmap |

## 3. Implementation sequence

1. **Data foundation:** local Supabase stack; Phase 2 migration; `Store.atomic` + `apply_batch`;
   Supabase Auth + email verification + MFA; profile trigger; demo seed with real auth users;
   integration tests against the stack (persistence, RLS cross-user, concurrency, duplicates).
2. **Workflow corrections:** extraction review; dual final-terms approval; qualifying-fee rule;
   realised vs projected savings; UI updates.
3. **Business verification:** ABN checksum + ABR client; credentials with evidence and expiry;
   admin approve/suspend; verified-only offers; verified-job reviews.
4. **Integrations:** Energy Made Easy CDR plans (real); SMTP notifications; payments and pricing
   interfaces; market configuration.
5. **Security & reliability:** rate limiting, malware scanning, AI document consent and handling,
   privacy export/deletion, health/monitoring, backup procedures, legal review list.
6. **Regression:** all six demo journeys on both drivers; updated handoff.

## 4. Risks and dependencies

- **Staging credentials (blocking for "staging"):** a hosted Supabase project URL, publishable/anon
  key and service-role key. Until provided, everything is tested against the local Supabase stack,
  which runs the same services but is not a hosted project.
- **ABN Lookup GUID:** needed for live ABN status. Without it only the checksum is verified, and an
  admin must confirm ABN status manually.
- **Licence registers:** no single national API; most state registers need agreements or keys.
  Licences will be admin-reviewed against evidence, never auto-marked verified.
- **ClamAV:** needs a `clamd` service and virus definitions; production uploads fail closed if no
  scanner is configured.
- **Email provider:** production needs an SMTP or transactional email account; locally Mailpit.
- **Energy data:** CDR prices are retailer-published; estimates depend on tariff type and usage and
  must be labelled as estimates. Only single-rate tariffs are costed in this phase.
- **Legal:** fee disclosure, savings claims, AI agent terms, privacy, credential verification
  wording and energy comparison rules need specialist review before public launch.
