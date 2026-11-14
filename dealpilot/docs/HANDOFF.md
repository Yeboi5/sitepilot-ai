# DealPilot: build status handoff

*Written for a planning assistant (e.g. ChatGPT) helping shape the project. It describes what has
actually been built from the original "DealPilot — Universal AI Savings & Negotiation Platform"
prompt, what was decided along the way, and what is still open.*

## 1. Where the code lives

- Repository: `yeboi5/sitepilot-ai`, branch `claude/dealpilot-platform-oe3fya`.
- The repo already contained a different product (**SitePilot AI**, an Australian property app).
  DealPilot was built as a **separate, self-contained app in the `dealpilot/` folder** with its own
  `package.json`, so SitePilot was not touched. Moving DealPilot to its own repository later is easy.
- Run locally with no accounts or keys:
  `cd dealpilot && npm install && cp .env.example .env.local && npm run dev`, then open `/sign-in`
  and click a demo account. `/journeys` walks through the six demo journeys; `/roadmap` lists what
  is live, simulated or future.

## 2. Status in one paragraph

A complete, navigable, mobile-first prototype of both portals (customer and business) plus an
admin page. All six required demo journeys work end to end and are covered by automated tests
(36 unit/workflow tests, 24 database integrity and access-control checks, and a browser
walk-through of all six journeys at phone size). It runs on seeded, clearly labelled fictional
data held in memory. The production database schema for Supabase exists and is tested, but the
full app has not yet been run against a real Supabase project. No real payments are taken and no
real companies are contacted.

## 3. Technology (as requested)

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres schema, row-level
security, private storage) · zod · Vitest · Playwright · Anthropic Claude SDK (optional).
Architecture is a **modular monolith** with four layers:

| Layer | Folder | Responsibility |
| --- | --- | --- |
| Pages & forms | `src/app/` | UI and server actions; parses forms only |
| Services | `src/lib/services/` | Permissions, state changes, ledger, audit log, notifications |
| Domain rules | `src/lib/domain/` | Pure logic: money, categories, savings, negotiation, offers, groups, monitoring, guardian |
| Adapters | `src/lib/store/`, `ai/`, `auth/` | Data storage (memory or Supabase), AI (mock or Claude), sessions |

## 4. What was built, mapped to the original prompt

| Prompt section | Built | Notes |
| --- | --- | --- |
| 1. Consumer portal | Yes | Dashboard, documents + AI analysis, requests & bid comparison, negotiation centre, group buying, price monitor, Money Guardian, savings & ledger, AI permission settings |
| 1. Business portal | Yes | Registration/profile (categories, regions, licence, insurance, ABN), matching requests, AI-drafted bids, negotiation inbox, bulk group offers, acquisition dashboard, transactions |
| 2. Universal categories | Yes | 10 categories in one registry (`domain/categories.ts`): trades, energy, telco, insurance, vehicle, retail, subscriptions, cleaning, moving, custom. Each defines its own fields, comparison weights, licence/insurance requirements and negotiation levers. Nothing is fencing-specific |
| 3. AI negotiation + 3 modes | Yes | Shared state machine for every category. Advisory, Approval and Limited Autopilot all implemented (Autopilot restricted to simulated counterparties) |
| 4. Competitive bidding | Yes | Compares total price, scope, materials, warranty, licence/insurance, completion time, and reviews only when verified. AI-drafted bids stay private until a person at the business approves them |
| 5. Collective bargaining | Yes | Groups with eligibility, region limits, tiered volume pricing, expiry, savings per member; businesses publish tiers; members take up the deal |
| 6. Price monitoring | Yes | Retail drops, price-adjustment windows, target prices, bill increases, subscription renewals, contract expiry. Data only from manual entry, approved APIs or a labelled simulated feed. No scraping |
| 7. Money Guardian | Yes | CSV/manual statements → duplicate charges, subscriptions, price increases. Never asks for bank passwords or moves money |
| 8. Revenue model | Yes (simulated) | Configurable fee, default AUD $1.50 per verified, completed saving. No fee if unsuccessful. Recorded in a ledger, never actually charged |
| 9. Technical requirements | Yes | Auth, roles, schema, private document storage, AI abstraction, category config, state machine, offers, ledger, savings maths, audit log, responsive dashboards. AI keys server-side only |
| 10. Six demo journeys | Yes | See section 6 |
| 12. Deliverables | Yes | Source, migrations, seeded demo accounts, AI config, `.env.example`, setup/deployment docs, tests, roadmap, CI workflow |

## 5. Key product and engineering decisions made during the build

These were decided independently because the prompt allowed it. Please review them.

1. **Money decisions are rule-based, not AI.** Targets, when to accept, counter or escalate, and
   autopilot limits are fixed code. The AI only reads documents and writes message wording; it can
   never change a price.
2. **Savings count only after the customer confirms the final invoice.** An agreed deal sits as
   "pending verification". On confirmation, the saving is recalculated from the *invoiced* amount
   (so a higher invoice lowers the saving), and only then is the fee calculated.
3. **The fee is capped at the amount saved.** A $1 saving costs $1, not $1.50. One fee per
   verified transaction, even if the saving is recurring.
4. **Recurring savings are shown as 12-month totals** (e.g. $27/month → $324/year).
5. **Businesses never see** the customer's target price, the AI's notes, competing bid prices, or
   the customer's identity before acceptance (sealed bidding).
6. **Offers missing a required licence or insurance never rank above compliant offers**, even when
   cheaper.
7. **Limited Autopilot** only acts when: the customer chose it, a spending limit is set, the amount
   is within it, any acceptance is at or below target, and the counterparty is simulated. Otherwise
   it falls back to asking for approval. Every autonomous action is audit-logged.
8. **Human approval is required** for every business offer and every customer message in Approval
   mode (an explicit "I approve" tick box).
9. **Sign-in uses the app's own secure session cookies** (scrypt passwords, signed httpOnly
   cookies), the same for both data modes. Supabase Auth is a roadmap item.
10. **The ledger and audit log are append-only**, and each fee has a unique key so it can't be
    recorded twice. These rules are enforced in code and again by database constraints.

## 6. The six demo journeys (all passing)

| # | Journey | Demo account | What happens |
| --- | --- | --- | --- |
| 1 | $5,500 fencing quote → competing bids | Alex (customer) | Quote analysed (line items, risks, fair-price range); 3 offers compared: $4,400 (no licence, no insurance), $4,950, $5,100 (registered demo business, 7-year warranty) |
| 2 | $120/month internet bill | Alex | Approve AI's ask of $84 → simulated provider counters $102 → AI recommends $93 → approve → agreed → verify: $27/month, $324/year saved |
| 3 | Retail price drop | Alex | Headphones bought at $449 drop to $399 within a 30-day adjustment window → alert → claim → verify $50 saving |
| 4 | Group buying | Alex | Joining the Sydney solar bulk-buy unlocks the 5-member tier ($6,600 vs $7,500); more members unlock $6,100 |
| 5 | Business counteroffer | Ben (business) | Sees the request without customer identity; AI drafts a counter; Ben approves and sends |
| 6 | Approve deal & verify savings | Alex + Ben | Alex counters, Ben accepts, Alex confirms the invoice → verified saving, $1.50 fee recorded (simulated) |

Demo password for all accounts: `DealPilotDemo!2026`. Accounts: `alex@`, `priya@`, `ben@`,
`erin@`, `admin@demo.dealpilot.test`.

## 7. Live vs simulated vs future

| Area | Live (works on real platform data) | Simulated (demo only, labelled) | Future (designed, not connected) |
| --- | --- | --- | --- |
| Accounts | Sign-up/in, sessions, customer/business/admin roles | — | Supabase Auth, email verification, MFA |
| Documents | Private upload, file checks, AI analysis | Fair-price benchmark ranges | Licensed price datasets |
| Marketplace | Requests, business offers, AI bids with approval, comparison | Fictional bidders | ABN/licence/insurance verification, verified reviews |
| Negotiation | State machine, Advisory/Approval modes, on-platform business negotiation | Replies from external providers (telcos, energy, insurers) | Authorised provider integrations; Autopilot with real providers |
| Group buying | Groups, tiers, volume offers, take-up | Seeded groups, placeholder members | Matching, committed/escrowed group purchases |
| Monitoring | Manual tracking and alert rules | Automatic price feed | Approved retailer/affiliate APIs |
| Money Guardian | CSV/manual analysis | — | Read-only bank data via Consumer Data Right |
| Revenue | Savings maths, verification, ledger | The $1.50 charge | Stripe payments, provider commissions, enterprise partnerships |

## 8. Data model (Supabase / Postgres)

Tables: `categories`, `profiles`, `businesses`, `documents`, `purchase_requests`, `offers`,
`negotiations` (message thread stored as JSON), `purchasing_groups` (tiered offers as JSON),
`price_watches` (price history as JSON), `alerts`, `expense_lines`, `transactions`,
`ledger_entries`, `audit_logs`.

Database-enforced rules include: savings must equal `max(before − after, 0)` and be correctly
annualised; fees only on verified transactions and never above the saving; real business offers
need an approving user; ledger and audit are append-only; price data sources limited to manual,
approved API or simulated. Row-level security lets signed-in users read only their own rows,
hides password hashes, and keeps negotiations and group member lists server-only.

## 9. Known gaps (honest list)

- Full app not yet run against a real Supabase project (schema and driver exist and are tested
  in isolation).
- In-memory demo data resets on server restart; serverless hosting would give each instance its
  own copy.
- Some multi-step writes (deal agreed → transaction → ledger) aren't wrapped in a single database
  transaction yet.
- No real payments, email/SMS notifications, rate limiting, upload malware scanning, or business
  verification.
- The offline AI only reads text files; PDFs and images need the Claude provider and an API key.
- No legal review yet of fee disclosure, consumer-law savings claims, or AI-agent terms.

## 10. Decisions needed from the product owner

1. Keep DealPilot in this repository, or move it to its own?
2. Fee model: is "one $1.50 fee per verified deal, capped at the saving" right? Should recurring
   savings (e.g. a monthly bill) earn a fee once, yearly, or per period?
3. Should savings on recurring bills be reported as 12-month totals (current) or per period?
4. Authentication: switch to Supabase Auth (email verification, MFA, social login) next?
5. Which real integrations first: payments (Stripe), energy plan data, telco partners, retailer
   price APIs, or Consumer Data Right banking?
6. Group buying: should joining become a binding commitment (deposit/escrow) once a tier unlocks?
7. Business side: free for now, or introduce commissions/subscriptions? How should businesses be
   verified (ABN lookup, licence registers, insurance certificates)?
8. Launch market: Australia only first (current assumption: AUD, Australian regulators), or
   multi-country from the start?

## 11. Suggested next build phases

1. Run everything on a staging Supabase project; make agreement → transaction → ledger atomic;
   move to Supabase Auth.
2. Stripe for the success fee (charged only on verified savings), with refunds and clear fee
   disclosure before every acceptance.
3. Business verification (ABN, licences, insurance expiry) and reviews from verified jobs only.
4. First real data sources behind the existing interfaces (energy plan data, partner APIs, CDR).
5. Email/SMS/push notifications and scheduled monitoring.
6. Production gates: rate limiting, upload scanning, privacy policy, accessibility audit,
   monitoring, backups, legal review.

## 12. Where to look in the code

- Overview and setup: `dealpilot/README.md`
- Architecture and security: `dealpilot/docs/ARCHITECTURE.md`
- Deployment: `dealpilot/docs/DEPLOYMENT.md`
- Roadmap and production gates: `dealpilot/docs/ROADMAP.md`
- Category registry: `dealpilot/src/lib/domain/categories.ts`
- Negotiation state machine and policy: `dealpilot/src/lib/domain/negotiation.ts`
- Savings and fee rules: `dealpilot/src/lib/domain/savings.ts`
- Database schema: `dealpilot/supabase/migrations/20261113000000_dealpilot_core.sql`
