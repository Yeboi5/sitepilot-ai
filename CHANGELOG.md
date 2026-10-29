# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/).

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
