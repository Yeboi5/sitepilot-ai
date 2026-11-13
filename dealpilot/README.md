# DealPilot

**Never overpay again.** A universal AI savings and negotiation platform: price discovery, AI-assisted
negotiation, competitive bidding, group buying, price monitoring and a "Money Guardian", with a
customer portal and a business portal in one mobile-first Next.js app.

> **Prototype.** All people, businesses, offers and savings in the demo are fictional and labelled.
> Every screen distinguishes **Live**, **Simulated** and **Future integration** features — see
> `/roadmap` in the app or [docs/ROADMAP.md](docs/ROADMAP.md). No real payments are taken.

## Quick start (no accounts or keys needed)

Requires Node 20.18+.

```bash
cd dealpilot
npm install
cp .env.example .env.local   # defaults: in-memory data, offline AI, $1.50 fee
npm run dev                  # http://localhost:3000
```

Open `/sign-in` and click a demo account, then follow `/journeys`.

| Demo account | Role | Used in |
| --- | --- | --- |
| `alex@demo.dealpilot.test` | Customer | Journeys 1, 2, 3, 4, 6 |
| `priya@demo.dealpilot.test` | Customer | Purchasing-group member |
| `ben@demo.dealpilot.test` | Business — Ben's Fencing & Gates | Journeys 5, 6 |
| `erin@demo.dealpilot.test` | Business — Bright Energy Co-op | Bulk offers |
| `admin@demo.dealpilot.test` | Admin | Audit log, ledger, demo reset |

Password for all: `DealPilotDemo!2026`. The in-memory store resets when the server restarts, or from
the admin page.

### The six demonstration journeys

1. **$5,500 fencing quote → competing bids.** Analysed quote, three offers compared on price, scope,
   materials, warranty, licence/insurance, completion time and *verified* reviews only.
2. **$120/month internet bill.** Approval mode: approve the AI's opening ask, the simulated provider
   counters at $102, AI recommends $93, approve, agree, verify → $324/yr saved.
3. **Retail price drop.** "Simulate feed update" drops the headphones from $449 to $399 inside the
   30-day adjustment window → alert → claim → verify.
4. **Group offer.** Joining the Sydney solar bulk-buy unlocks the 5-member tier ($6,600); simulated
   neighbours unlock the 10-member tier ($6,100).
5. **Business counteroffer.** Ben sees the request (customer identity hidden), drafts a counter with
   AI, approves and sends it.
6. **Approve & verify.** Alex counters, Ben accepts, Alex confirms the final invoice → verified
   saving, $1.50 success fee recorded (simulated) in the append-only ledger.

## Configuration

All settings are in [.env.example](.env.example). Anything without `NEXT_PUBLIC_` stays on the server.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATA_DRIVER` | `memory` | `memory` (seeded demo) or `supabase` |
| `SESSION_SECRET` | dev value | HMAC key for session cookies. **Required (32+ chars) in production** |
| `AI_PROVIDER` | `mock` | `mock` (offline, deterministic) or `anthropic` |
| `ANTHROPIC_API_KEY` | — | Server-only. Read only in `src/lib/ai/anthropic.ts` |
| `AI_MODEL` | `claude-opus-5-5` | Model for the Anthropic provider |
| `SUCCESS_FEE_CENTS` | `150` | Fee per verified, completed saving |
| `FEE_CURRENCY` | `AUD` | Ledger currency |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase driver |

### AI integration

`src/lib/ai/types.ts` defines the provider interface (document analysis, negotiation messages, bid
drafts, business counters). Two implementations:

- **Mock** — offline, free, deterministic; reads text files and uses simulated benchmark ranges.
- **Anthropic** — Claude via `@anthropic-ai/sdk`, structured outputs validated with zod, reads PDFs
  and images, with server-side refusal fallbacks enabled (`fallbacks: "default"`). Any error or
  refusal falls back to the mock so the app keeps working, and the analysis is labelled with the
  provider that produced it.

Money decisions — targets, accept/counter/escalate, autopilot limits — are deterministic domain code.
The AI only extracts facts and writes wording, and it can never change a price.

### Supabase

```bash
npx supabase start                       # or use a hosted project
psql "$DATABASE_URL" -f supabase/migrations/20261113000000_dealpilot_core.sql
npm run db:seed && psql "$DATABASE_URL" -f supabase/seed.sql   # optional demo data
```

Then set `DATA_DRIVER=supabase`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Demo
document files aren't in `seed.sql`; upload your own. The Supabase driver is implemented and the
schema is tested, but the full app has not yet been run end-to-end against a hosted project — see
the roadmap.

## Tests

| Command | What it covers |
| --- | --- |
| `npm test` | 36 unit + workflow tests: money, fees, savings, state machine, autopilot guard, sessions, uploads, guardian, and all six journeys through the service layer, including permission checks |
| `npm run test:db` | Applies the migrations and seed to plain PostgreSQL (`TEST_DATABASE_URL`) and checks 24 rules: savings/fee constraints, append-only ledger and audit, idempotent fees, human-approved offers, RLS isolation, private storage |
| `npm run test:e2e` | Drives all six journeys in a phone-sized Chromium against a running server (`BASE_URL`). Needs Playwright installed |
| `npm run check` | typecheck + unit tests + production build |

CI: [.github/workflows/dealpilot.yml](../.github/workflows/dealpilot.yml).

## More

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): modules, data model, security
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Vercel + Supabase
- [docs/ROADMAP.md](docs/ROADMAP.md): prototype vs production integrations

DealPilot provides general information only, not financial, legal or insurance advice.
