# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/).

## [0.6.0] - 2026-10-30

Master Blueprint v2.0, V2-3: Search Any Address, My Property, homeowner claims and buyer enquiries.

### Added
- Migration `20261030030000_my_property.sql`: `owned_properties`, `property_notes`,
  `maintenance_items`, `claim_verifiers`, `homeowner_claims` (pending → verified / rejected /
  withdrawn; one open claim per home, one verified owner per address) and `buyer_enquiries`
  (owner opt-in, verified owners only, 5 per buyer per day, message immutable). RPCs
  `decide_claim`, `record_claim_evidence_view`, `clear_claim_evidence`,
  `enquiry_target_for_record` (opaque id only) and `am_i_claim_verifier`. Private
  `claim-evidence` storage bucket (PDF/JPEG/PNG, 10 MB).
- `/search`: demo address search behind an `AddressProvider` interface (G-NAF can slot in later),
  with "This is my home", "Analyse" (prefills `/analyse`) and plain outbound links to Domain and
  realestate.com.au. No listing-site data is fetched or scraped.
- My Property: add a home, ownership card, value-history placeholder (no licensed valuation data),
  maintenance checklist (dated in the property's time zone), curated maintenance and renovation
  ideas, notes, saved-concepts placeholder, and remove-home (deletes evidence too).
- Homeowner claims: owner declaration plus a document checked by file signature; manual review
  queue at `/verify` for verifiers, audited evidence downloads (always as attachments), and the
  document is deleted after a decision. A rejection must give the claimant a reason.
- Buyer enquiries on off-market listings: verified owners opt in; buyers register interest
  through SitePilot without exchanging contact details (phone numbers and emails are rejected);
  owners reply, decline or close; opting out closes open enquiries.
- `STORAGE_DRIVER=local` for development and CI (no Storage service locally); refused in
  deployed environments.
- Demo verifier account `vera.verifier@demo.sitepilot.test`; Ivy owns a verified demo home that
  accepts enquiries.
- Tests: 19 RLS tests (110 total), 7 unit tests (166 total), 3 browser tests (44 total).

### Changed
- The dashboard's "Search any address" tile opens `/search`. `/my-property` now requires sign-in.

### Fixed (before release)
- The type generator treated partial unique indexes as one-to-one relationships.
- Claim and enquiry inserts were refused because the stamped owner columns had no insert grant;
  regression tests now use the app's insert shape (the triggers still overwrite spoofed values).
- A flaky browser test cleared cookies before a Save request finished.

## [0.5.0] - 2026-10-30

Master Blueprint v2.0, V2-2: nationwide demo Discover.

### Added
- Migration `20261030020000_discovery.sql`: `property_records` (canonical addresses), `listings`
  (constraints: off-market rows are NOT FOR SALE, with no price or street address), `swipe_events`
  (append-only, rate-limited to 1,000 per user per hour) and `saved_properties`. Guests can read
  DEMO listings and records only; activity is owner-only. `properties.property_record_id` (nullable).
- 48 synthetic DEMO listings across all eight states and territories
  (`scripts/gen-demo-listings.ts`): real suburbs, fictional "[DEMO] … Example Lane" addresses,
  illustrative prices, and land-appropriate ideas. Off-market rows carry no price, address or rent.
- Find My Home and Find My Investment swipe decks: drag, Save/Pass buttons, ← / → keys, undo,
  screen-reader announcements, reduced-motion support. For Sale and Off-Market Potential tabs, a
  NOT FOR SALE notice, and state and bedroom filters.
- Listing cards with deterministic illustrations (no photos). Investment cards show an indicative
  gross yield (`signals-1.0.0`) with "Assumptions and source", idea and risk prompts.
- Listing detail with provenance; Save toggle.
- `/saved` (Homes and Investments): synced for signed-in users, kept on the device for guests,
  with one-click import of on-device saves after sign-in.
- Tests: 11 RLS tests (91 total), 25 unit tests (159 total), 10 browser tests (41 total).

### Fixed (before release)
- The swipe rate limit ran before the user was stamped, so it never triggered. The triggers are
  now numbered to fix their order, and a test proves the limit works.

## [0.4.0] - 2026-10-30

Master Blueprint v2.0, increment V2-1: dashboard v2 and nationwide foundation.

### Added
- Dashboard quick actions per v2.0: **Search any address**, **My Property**, **SitePilot
  Vision**, Analyse, Saved, Alerts, Find a pro. My Property and Vision have preview screens.
- Nationwide property workspaces: migration `20261030010000_nationwide.sql` allows all eight
  states and territories (NSW stays the default). The property form has a state selector.
- `src/lib/jurisdictions.ts`: states, Australia Post postcode ranges, and time zones (Broken Hill
  on South Australian time). `dateForProperty()`: "today" where the property is.
- v2.0 feature flags: `nationwide`, `myProperty`, `homeownerClaims`, `buyerEnquiries`, `vision`,
  `visionRealProvider` (off: mock provider), `matterport`, `dutyPresets`.
- `docs/BLUEPRINT_V2_PLAN.md` (approved) and the v2.0 blueprint.
- Tests: 9 RLS tests (80 total), 39 unit tests (134 total), 5 browser tests (31 total).

### Changed
- Postcodes are validated against the chosen state ("That postcode isn't in WA").
- Evidence "date retrieved" defaults to, and is checked against, the property's local date (Perth,
  Brisbane, Darwin and others), not Sydney's.
- Wording is no longer NSW-only: state planning portal, state revenue office for duty, "Lot and
  plan" with examples per state, a nationwide Find a pro preview, and an updated site description.

## [0.3.0] - 2026-10-30

Update Pack 1.1, Phase B: dashboard, responsive navigation and design refresh.

### Added
- Dashboard at `/` for guests and signed-in users: "Find your place. Discover its potential."
  hero, Find My Home / Find My Investment entry cards, quick actions (Search address, Analyse a
  property, Saved properties, Alerts, Find a pro), "How it works" for guests, and "Your
  projects" for investors.
- Responsive app shell: top bar on desktop and a bottom tab bar on phones (Home, Discover,
  Analyse, Projects, Profile). Conveyancers get Inbox, Review, Profile; guests get Sign in.
  Tab targets are at least 44px, and the bar respects the iPhone safe area.
- Design tokens: soft blue (`brand`), green (`leaf`) and warm neutrals (`sand`); Nunito display
  font (self-hosted); rounder cards; 44px buttons and inputs; reduced-motion support.
- Personal workspaces: `ensure_personal_workspace()` RPC creates a home buyer's investor
  workspace on first sign-in or email confirmation. Sign-up has an "I'm setting up a
  conveyancing or law firm" option; firms still set up in onboarding, which now also offers
  one-click "Continue with a personal workspace".
- `/analyse` (start a workspace from an address), `/about` (previous landing page), and
  placeholder screens for Discover, Saved, Alerts and Find a pro.
- Feature flags (`src/lib/flags.ts`): `discovery`, `couples`, `alerts`, `findAPro`, on only when
  `NEXT_PUBLIC_FLAG_*` is `"on"`.
- Seed: Nina Newbuyer, a consumer with no workspace, to test first sign-in.
- Tests: 4 RLS tests (71 total), 3 unit tests (95 total), 10 browser tests (26 total) including an
  iPhone-size project (390×844) that checks tap targets and horizontal overflow.

### Changed
- Investors land on `/` after sign-in; `/investor` redirects there (its content moved to
  "Your projects").
- "Settings" is labelled **Profile**, with an organisation switcher on mobile.
- The pricing page is no longer linked from navigation (kept at `/pricing` until pricing is agreed).
- Generated types use `never` for functions without arguments, matching the Supabase CLI.

### Removed
- `MarketingShell` (replaced by the app shell on every page).

## [0.2.0] - 2026-10-29

Sprint 2: scenario engine, comparison, sensitivity and report export.

### Added
- Feasibility engine (`src/lib/finance/`, formula `feasibility-1.0.0`): deterministic pure
  TypeScript for develop-and-sell (TDC, margin, ROI) and retain-and-rent (incremental cost, yield,
  cash flow after interest, uplift minus costs). Includes a monthly debt draw schedule with
  capitalised interest, an equity requirement, and warnings for negative outcomes. Spec in
  `docs/FORMULAS.md`.
- Sensitivity analysis: build cost ±15% × end value ±15% matrix, plus interest ±2 pp.
- Scenario editor, scenario page (headline figures, cost breakdown, tornado chart, sensitivity
  heatmap, interest table, change history), scenario comparison, and confirmed deletion.
- Feasibility and due-diligence report in four separated sections (sourced facts, assumptions,
  AI flags, reviewer-confirmed conclusions) plus limitations. View in-app, print to PDF, or
  download as a standalone script-free HTML file. All values are HTML-escaped.
- `record_report_export()` writes report views and downloads to the audit log.
- Tests: 49 finance/report unit tests, 6 new RLS tests (67 total), 5 new browser tests (16 total).

### Changed
- Property page lists scenarios with their headline result and links to compare and report.
- Audit log shows readable action names. Generated types map `void` functions to `undefined`.

## [0.1.3] - 2026-10-29

### Security
- **Revoked sessions lose database access immediately.** Migration
  `20261029020000_session_revocation.sql` makes `app.current_user_id()` require that the JWT's
  `session_id` is still live in `auth.sessions`. Previously a copied access token kept working
  against the data API for up to an hour after sign-out.
- 7 RLS tests for revocation (signed-out session can't read, write or create an organisation;
  other sessions unaffected; missing, expired or borrowed session ids denied), confirmed to fail
  without the fix. One live-stack end-to-end test (`tests/e2e/session-revocation.spec.ts`).

## [0.1.2] - 2026-10-29

First full run against real Supabase Auth (GoTrue v2.197.0) + PostgREST 12.2.3 with the seeded demo data.

### Added
- Playwright end-to-end tests (`npm run test:e2e`, 10 tests) for both role views, tenant isolation and sign-out.
- `src/lib/dates.ts`: `sydneyDate()` and `APP_TIME_ZONE`.

### Fixed
- Evidence retrieved "today" was rejected as a future date from midnight to 10–11am Sydney time,
  because the form used the Sydney date and the server validated against UTC. Both now use the Sydney calendar date.
- Seed now creates `auth.identities` rows and empty token columns, as Supabase Auth requires for password sign-in.
- Firm matter view explains that the client hasn't granted access when the matter is already active.

### Security
- Found: access tokens remained valid against the data API for up to 1 hour after sign-out (fixed in 0.1.3).

## [0.1.1] - 2026-10-29

### Added
- Demo property **76 Sunrise Avenue, Halekulani NSW 2262** with placeholder (unverified) planning
  certificate, Planning Portal and valuation evidence. No official results are fabricated.
- `is_demo` flag on properties and evidence: demo evidence can never be verified (check
  constraint); users can't set or clear the flag; evidence on a demo property is always demo.
- `valuation` evidence source type.
- Conveyancer matter view (`/firm/matters/[id]`): property, read-only evidence register, shared
  documents with finding statuses, and tasks, all filtered by RLS grants.
- Shared `EvidenceRegister` component and "Demo · unverified" badges and banners.
- `docs/SPRINT_0_1_PLAN.md` covering architecture, directory tree, schema, RLS design and test strategy.
- 8 more RLS tests (54 total).

### Changed
- All seeded evidence is now unverified demo data with `.invalid` source URLs; demo lot/DP removed.

## [0.1.0] - 2026-10-29

Sprint 0 + Sprint 1: foundation.

### Added
- Next.js 15 App Router + TypeScript + Tailwind application scaffold with ESLint, Vitest and
  GitHub Actions CI (lint, typecheck, unit tests, RLS tests, generated-types drift check, build).
- Supabase schema for the full MVP data model: users, organisations, memberships, properties,
  evidence, scenarios, scenario results, documents, findings, matters, matter access, tasks,
  audit events, subscriptions; private `documents` storage bucket.
- Deny-by-default row-level security with organisation isolation, matter-level grants (active
  matters only), revocation, server-stamped authorship/verification/review fields, immutable AI
  output, matter status transition guard and trigger-written audit trail.
- 46 database tests covering permitted **and** denied access across tenants, roles and lifecycle
  states; Supabase shim so tests run on plain PostgreSQL.
- Synthetic seed data (two investor organisations, one conveyancing firm, matters, a synthetic
  contract with findings, tasks).
- Supabase Auth: sign-up with email confirmation, sign-in, POST-only sign-out, session refresh
  middleware, protected routes, open-redirect protection.
- Onboarding to create an investor or professional organisation; organisation switcher.
- Investor dashboard, property list, add property (NSW validation), property overview with
  planning-checks notice and evidence register (add, verify, dispute, supersede).
- Firm matter inbox and review queue (read-only), organisation settings with members, plan and
  admin-only audit log.
- Marketing home and pricing pages (hypothesis AUD pricing; billing not live).
- Security headers (CSP, HSTS, frame denial, nosniff, referrer and permissions policies).
- Docs: README, ARCHITECTURE, DATA_DICTIONARY, SECURITY (threat model), ADR 0001.
- `scripts/gen-db-types.ts` to generate Supabase-compatible DB types without Docker.
