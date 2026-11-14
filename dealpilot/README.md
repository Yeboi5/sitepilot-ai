# DealPilot

**Never overpay again.** A universal AI savings and negotiation platform: price discovery, AI-assisted
negotiation, competitive bidding by verified businesses, group buying, price monitoring and a
"Money Guardian", with customer, business and admin portals in one mobile-first Next.js app.

> **Status: Phase 2 — real-world foundation.** Real persistence, Supabase Auth with email verification and
> MFA, atomic deal/verification/ledger writes, business verification, and one live government data
> integration. Tested end to end against a local Supabase stack; **not yet deployed or connected to a
> hosted project.** Demo data is fictional and every simulated item is labelled. No real charges are
> taken. See [docs/HANDOFF.md](docs/HANDOFF.md).

## Two ways to run it

### 1. In-memory demo (no setup)

```bash
cd dealpilot
npm install
cp .env.example .env.local      # DATA_DRIVER=memory
npm run dev                     # http://localhost:3000 → /sign-in → click a demo account
```

### 2. Real persistence with a local Supabase stack (needs Docker)

```bash
npm run supabase:start          # Postgres, Auth, Storage, Mailpit (emails) — applies migrations + demo seed
npx supabase status -o env      # copy API_URL, ANON_KEY, SERVICE_ROLE_KEY into .env.local:
#   DATA_DRIVER=supabase  DEMO_MODE=true  NEXT_PUBLIC_SUPABASE_URL=…  NEXT_PUBLIC_SUPABASE_ANON_KEY=…
#   SUPABASE_SERVICE_ROLE_KEY=…  NEXT_PUBLIC_APP_URL=http://localhost:3000  SMTP_URL=smtp://127.0.0.1:54325
npm run dev
```

Sign-up confirmation emails and notifications appear in Mailpit at http://127.0.0.1:54324. The admin
demo account must enrol an authenticator app on first sign-in (MFA is mandatory for admins).
Reset the database any time with `npx supabase db reset`.

Optional services: ClamAV (`docker run -d -p 3310:3310 clamav/clamav:stable`, then `CLAMD_HOST=127.0.0.1`),
an ABN Lookup GUID (`ABR_GUID`), and `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY`.

## Demo accounts (fictional)

| Account | Role | Used in |
| --- | --- | --- |
| `alex@demo.dealpilot.test` | Customer | Journeys 1, 2, 3, 4, 6 |
| `priya@demo.dealpilot.test` | Customer | Purchasing-group member |
| `ben@demo.dealpilot.test` | Business — Ben's Fencing & Gates (verified demo business) | Journeys 5, 6 |
| `erin@demo.dealpilot.test` | Business — Bright Energy Co-op | Bulk offers |
| `admin@demo.dealpilot.test` | Admin | Audit, ledger, business verification |

Password for all: `DealPilotDemo!2026`. One-click demo sign-in is available only with the memory
driver or `DEMO_MODE=true`.

## The real workflow

1. Customer uploads a quote or bill → malware scan → private storage → AI extraction (external AI only
   with consent).
2. Customer **reviews and corrects** the extracted details; only confirmed values are used.
3. Customer creates a purchase request; matching **verified** businesses are notified.
4. Businesses submit genuine offers (AI may draft; a person must approve).
5. Customer compares offers on price, scope, materials, warranty, **verified** licence/insurance,
   completion time and reviews from verified jobs, then negotiates.
6. **Both parties explicitly approve the final terms.** AI never approves, signs or pays.
7. Customer confirms the final invoiced amount; savings are recalculated from it.
8. A AUD $1.50 fee is **assessed** once per completed, verified, qualifying saving, capped at the
   saving. Payments are disabled, so nothing is charged.

## Configuration

See [.env.example](.env.example). Key settings: `DATA_DRIVER`, `DEMO_MODE`, `MFA_REQUIRED_ROLES`,
`MARKET` (AU/NZ/GB), `SUCCESS_FEE_CENTS`, `PAYMENTS_PROVIDER` (stays `none`), `AI_PROVIDER`,
`CLAMD_HOST`, `SMTP_URL`, `ABR_GUID`, `CDR_ENERGY_BRANDS`.

## Tests

| Command | Covers | Needs |
| --- | --- | --- |
| `npm test` | 68 unit/workflow tests: domain rules, all six journeys, dual approval, concurrency (simultaneous verifications, verify-vs-cancel races, stale writes, rollback), verification gating, reviews, uploads/malware, AI consent, energy costing, notifications, payments disabled, privacy | nothing |
| `npm run test:integration` | 20 tests against **real services**: Supabase Auth sign-up + email confirmation (Mailpit), role escalation, TOTP MFA, RLS with real user tokens, persistence, concurrent verification, DB-level guards, Storage privacy, rate limits, business verification, account deletion, SMTP delivery, ClamAV (if running), Energy Made Easy (with `LIVE_NETWORK=1`) | local Supabase stack |
| `npm run test:db` | 24 schema/RLS checks on plain PostgreSQL (fast, no Docker) | PostgreSQL |
| `npm run test:e2e` | Browser walk-through of all six journeys plus verification, MFA, privacy and energy pages at phone size; run against either driver (`BASE_URL`) | running app, Playwright |

## Documentation

- [docs/HANDOFF.md](docs/HANDOFF.md): status, test results, open issues, credentials needed, next stage
- [docs/PHASE2_AUDIT.md](docs/PHASE2_AUDIT.md): pre-Phase-2 audit
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): modules, data model, integrity model
- [docs/SECURITY.md](docs/SECURITY.md): controls, monitoring, backups, incidents
- [docs/LEGAL_REVIEW.md](docs/LEGAL_REVIEW.md): items for specialist review before launch
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/ROADMAP.md](docs/ROADMAP.md)

DealPilot provides general information only, not financial, legal or insurance advice.
