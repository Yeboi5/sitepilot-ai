# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/).

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
