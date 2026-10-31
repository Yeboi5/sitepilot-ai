# SitePilot AI

A two-sided Australian property feasibility and conveyancing collaboration platform. The initial
market is NSW. Investors research properties, keep a sourced evidence register and (soon) model
development scenarios. Licensed conveyancers accept client matters and verify AI-flagged issues
with professional sign-off.

> SitePilot AI does not provide legal, planning, financial or tax advice. It does not hold client
> funds, settle, lodge or transfer title. **Use synthetic data only** until the compliance gates in
> [docs/SECURITY.md](docs/SECURITY.md) are passed.

**Status:** Sprints 0–2 and Update Pack 1.1 Phase B complete. Master Blueprint v2.0 approved:
V2-1 (dashboard v2, nationwide workspaces) and V2-2 (nationwide demo Discover: swipe decks,
saved lists) complete; V2-3 (Search Any Address, My Property) next. See
[docs/BLUEPRINT_V2_PLAN.md](docs/BLUEPRINT_V2_PLAN.md) and [CHANGELOG.md](CHANGELOG.md).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Storage, RLS) ·
zod · Vitest · GitHub Actions. Planned: Stripe (sandbox), Sentry, Vercel.

## Getting started

Prerequisites: Node 20.18+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage; applies migrations + seed.sql
cp .env.example .env.local  # paste the API URL and anon/publishable key printed above
npm run dev                 # http://localhost:3000
```

### Demo data

The seed contains **synthetic fixtures only**. The primary demo property is
**76 Sunrise Avenue, Halekulani NSW 2262**, owned by the demo investor and shared with the demo
conveyancer on an active matter.

All planning and valuation information is **UNVERIFIED demo data**: placeholder evidence records
with no zoning, planning-control, lot/DP or valuation figures, and source URLs on the reserved
`.invalid` domain. Demo records are flagged `is_demo`, shown with a "Demo · unverified" badge, and the
database prevents them from ever being marked verified. Never load real client contracts or documents.

Demo accounts, all with password `SitePilotDemo!2026`:

| Email | Role |
| --- | --- |
| `ivy.investor@demo.sitepilot.test` | Investor admin, Harbourview Demo Developments |
| `connie.conveyancer@demo.sitepilot.test` | Firm admin, Demo Conveyancing; granted on the Halekulani matter |
| `sam.staff@demo.sitepilot.test` | Firm member without matter grants |
| `oscar.other@demo.sitepilot.test` | Admin of a separate investor organisation |
| `nina.newbuyer@demo.sitepilot.test` | Home buyer with no workspace yet (first sign-in creates one) |
| `vera.verifier@demo.sitepilot.test` | Homeowner-claim verifier (review queue at `/verify`) |

Suburb profiles (`/suburbs`) use DEMO statistics for the demo towns until real NSW figures are
loaded. Regenerate them with `npx tsx scripts/gen-demo-suburbs.ts`.

Compare My Properties works on DEMO listings with DEMO estimate ranges. No stamp duty rates are
loaded yet (`duty_presets` is empty), so enter a duty estimate per property to see cash required
and scores; reviewed state presets will fill this automatically.

To load duty rates: enter each state's general transfer duty brackets in
`supabase/reference/duty-presets.json`, copied from that state's revenue office website (the loader
rejects any other source), then run `npx tsx scripts/load-duty-presets.ts` and reseed. New entries
are marked "needs review" in the app until `status`, `reviewed_by` and `reviewed_at` are set.
NT duty below its top threshold is formula-based, not bracketed, and needs formula support first.

SitePilot Vision uses a built-in mock image provider (no AI service, no cost). Concepts are
limited to 10 per user per day; reseeding resets the counters.

Claim evidence and Vision uploads use Supabase Storage. Without a Storage service (e.g. CI), set
`STORAGE_DRIVER=local` to keep files in `.local-storage/`; it is refused in deployed environments.

Local auth emails (sign-up confirmation) are captured by Mailpit at http://127.0.0.1:54324.

Reset the local database: `npx supabase db reset`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (`src/**/*.test.ts`) |
| `npm run test:db` | RLS/database integration tests against PostgreSQL |
| `npm run test:e2e` | Browser end-to-end tests (needs the local Supabase stack) |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the schema |
| `npm run check` | Everything above, as CI runs it |

## Testing

RLS tests run against **plain PostgreSQL** (no Docker needed). `tests/db/global-setup.ts`
recreates the database from `supabase/tests/supabase-shim.sql` (a minimal `auth`/`storage`
stand-in), then the migrations, then the seed. Each test runs in a rolled-back transaction while
impersonating a user through JWT claims, as PostgREST does.

```bash
# any Postgres 15+ superuser connection; the database is dropped and recreated
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sitepilot_test
npm run test:db
```

The types generator uses the same database, so run `npm run test:db` first. With the Supabase
CLI available, `npx supabase gen types typescript --local` produces equivalent output.

### End-to-end (browser) tests

`tests/e2e/` drives the real app with Playwright against the local Supabase stack and the seeded
demo accounts: sign-in, the investor view of the Halekulani demo property, creating a property and
verifying evidence, the conveyancer matter view and review queue, an ungranted firm member,
cross-tenant 404s, sign-out, and that a token captured before sign-out stops working against the API.

```bash
npx supabase start && npx supabase db reset   # fresh seed
npx playwright install chromium               # first run only
npm run test:e2e                               # builds, starts on :3000, runs tests
```

Tests tagged `@mobile` run in an iPhone-size project (390×844). Set `E2E_BASE_URL` to test an already-running server. `PLAYWRIGHT_CHROMIUM_PATH` overrides the browser binary.

## Documentation

- [docs/SPRINT_0_1_PLAN.md](docs/SPRINT_0_1_PLAN.md): architecture plan, directory tree, schema, RLS design, test strategy
- [docs/BLUEPRINT_V2_PLAN.md](docs/BLUEPRINT_V2_PLAN.md): Master Blueprint v2.0 gap analysis, limitations and roadmap (approved)
- [docs/UPDATE_1_1_PLAN.md](docs/UPDATE_1_1_PLAN.md): Update Pack 1.1 gap analysis and phases
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system design, request flow, sprint plan
- [docs/FORMULAS.md](docs/FORMULAS.md): feasibility formulas, versioning and sensitivity spec
- [docs/VISION_PROVIDERS.md](docs/VISION_PROVIDERS.md): checklist for choosing a real SitePilot Vision image provider
- [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md): every table and column
- [docs/SECURITY.md](docs/SECURITY.md): threat model, controls, gaps, compliance gates
- [docs/adr/](docs/adr/): architecture decision records
- [CHANGELOG.md](CHANGELOG.md)

## Deployment notes

- Create separate Supabase projects for staging and production in the **Sydney** region.
- Apply migrations with `npx supabase db push`; never run `seed.sql` against production.
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` in Vercel.
  Server-only secrets (service-role key, Stripe, AI provider) are added in later sprints and must
  never use the `NEXT_PUBLIC_` prefix.
- Configure Auth URL settings (site URL, redirect URL `…/auth/confirm`) and email templates using
  the token-hash link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.
