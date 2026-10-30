# Architecture

See [ADR 0001](adr/0001-stack-and-tenancy.md) for the reasoning behind these choices.

```
Browser ──HTTPS──▶ Next.js (App Router, Vercel)
                    │  middleware: session refresh + route gating
                    │  Server Components / Server Actions (zod validation)
                    │  Supabase client with the *user's* JWT (RLS enforced)
                    ▼
               Supabase (Sydney region)
                    ├─ Auth (email/password, email confirmation, TOTP MFA)
                    ├─ PostgreSQL: public schema (tables + RLS), app schema (private helpers)
                    └─ Storage: private `documents` bucket (storage RLS)

Later sprints:  job queue + document worker (service role) ──▶ AI provider interface
                Stripe webhooks (service role) ──▶ subscriptions
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `supabase/migrations/` | SQL schema, RLS policies, triggers, RPCs (source of truth) |
| `supabase/seed.sql` | Synthetic demo data (fixed UUIDs used by tests) |
| `supabase/tests/supabase-shim.sql` | Minimal `auth`/`storage` stand-in for plain-Postgres RLS tests |
| `tests/db/` | RLS integration tests (permitted + denied) |
| `scripts/gen-db-types.ts` | Generates `src/lib/supabase/database.types.ts` from the schema |
| `src/middleware.ts` | Session refresh and protected-route redirect |
| `src/lib/supabase/` | Server/middleware Supabase clients, generated DB types |
| `src/lib/session.ts` | Current user, memberships, active organisation (`requireOrg`) |
| `src/lib/validation.ts` | zod schemas for all user input |
| `src/lib/billing/plans.ts` | Plan catalogue (display only until Stripe sandbox) |
| `src/lib/finance/` | Feasibility engine, sensitivity, assumption schema and form definitions (see FORMULAS.md) |
| `src/lib/report/` | Report model, escaped HTML renderer, loader |
| `src/components/scenario/` | Scenario editor, results, tornado chart, sensitivity heatmap |
| `src/app/(public)/` | Pages guests can browse: dashboard `/`, `/about`, `/discover/*`, `/saved`, `/alerts`, `/pros`, `/pricing` (unlinked) |
| `src/components/shell/` | Responsive app shell: desktop top bar, mobile bottom tabs, per-audience nav items |
| `src/components/dashboard/` | Hero, entry cards, quick actions, "Your projects" |
| `src/lib/flags.ts` | Feature flags (`NEXT_PUBLIC_FLAG_*`) |
| `src/lib/discovery/` | Deck reducer, guest on-device store, indicative signals, listing types |
| `src/components/discovery/` | Swipe deck, listing card, illustration, deck page, saved list |
| `scripts/gen-demo-listings.ts` | Generates the DEMO listings block in `supabase/seed.sql` |
| `src/lib/jurisdictions.ts`, `src/lib/dates.ts` | States and territories, postcode ranges, per-property time zones |
| `src/app/(app)/analyse/` | Start a workspace from an address |
| `src/app/(app)/investor/` | Property workspaces, evidence register, scenarios, report (`/investor` redirects to `/`) |
| `src/app/(app)/firm/` | Firm matter inbox, matter view (read-only, grant-filtered), review queue |
| `src/app/(app)/settings/` | Organisation, members, plan, audit log |
| `src/components/` | Accessible UI primitives and form helpers |

## Request flow (example: add evidence)

1. Browser submits the form → Server Action `addEvidence(propertyId, formData)`.
2. `requireOrg("investor")` resolves the user via `getClaims()` (JWT verified).
3. Input is parsed with `evidenceSchema`; failures return field errors.
4. Insert runs through the user's Supabase client → RLS `evidence_insert` checks the user belongs
   to the property's owning organisation.
5. Triggers stamp `created_by`, verification fields, and write an `audit_events` row.
6. `revalidatePath` refreshes the property page.

## Authorisation helpers (SQL, `app` schema)

| Function | Answers |
| --- | --- |
| `session_is_active()` | The JWT's `session_id` is still live in `auth.sessions` (not signed out or past `not_after`) |
| `current_user_id()` | `public.users.id` for `auth.uid()`, or null when the session is no longer active |
| `is_member(org)` / `is_org_admin(org)` | Membership / admin role in an organisation |
| `has_matter_access(matter, min_perm)` | Caller holds a grant ≥ `min_perm` on an **active** matter |
| `can_read_property(prop)` / `can_write_property(prop)` | Owner org member (read also via matter grant) |
| `can_read_document(doc)` / `can_review_document(doc)` | Owner org, or matter grant (review needs `edit`) |
| `is_matter_participant(matter)` | Investor-side member or grant holder |

## Matter lifecycle

```
invited ──firm admin──▶ active ──either side──▶ closed
   │  └──firm admin──▶ declined
   └──investor──▶ revoked ◀──investor── active
```

Enforced by `app.guard_matter_transition` plus the `matters_update` policy. Access to client
files requires `status = 'active'`.

## Sprint plan

| Sprint | Scope | Status |
| --- | --- | --- |
| 0 | Repo, ADR, schema, threat model, synthetic data | ✅ |
| 1 | Auth, organisations, RLS, property workspaces, manual planning evidence | ✅ |
| 2 | Scenario engine (pure TS, versioned formulas), comparison, sensitivity, report export | ✅ |
| 3 | Private upload, malware scan, text extraction, cited AI findings, human review, MFA enforcement | Next |
| 4 | Professional invitations, engagement checklist, matters, tasks, milestones, messages, notifications | |
| 5 | Stripe sandbox, security tests, user testing, compliance review, controlled beta | |

Update Pack 1.1 phases (B–F) are tracked in [UPDATE_1_1_PLAN.md](UPDATE_1_1_PLAN.md); the current
roadmap is Master Blueprint v2.0, [BLUEPRINT_V2_PLAN.md](BLUEPRINT_V2_PLAN.md).
