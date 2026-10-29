# Sprint 0 + Sprint 1 plan

Scope: blueprint §11 Sprint 0 (repo, ADR, design system, schema, threat model, synthetic data)
and Sprint 1 (auth, organisations, RLS, property workspaces, manual planning evidence), plus the
initial investor and conveyancer role views. **Out of scope:** feasibility engine, document
upload/AI, invitations workflow, billing, legal advice, settlement, trust payments, and any live
third-party data integration.

## 1. Architecture (brief)

- **One Next.js 15 App Router app (TypeScript, Tailwind).** Server Components read data; Server
  Actions mutate it after zod validation. No client-side data fetching, so no Supabase keys are used
  in browser code paths.
- **Supabase** provides Postgres, Auth (email + password, email confirmation, TOTP enabled) and
  private Storage. The app always queries with the **signed-in user's JWT**, so **RLS is the
  authorisation layer**. There is no service-role client in Sprint 0/1.
- **Tenancy:** organisations (`investor` | `professional`) own data. Professionals reach client data
  only through an **active matter + explicit `matter_access` grant**.
- **Privileged logic in SQL:** `SECURITY DEFINER` helpers in a private `app` schema; triggers stamp
  authorship/verification fields, guard state transitions, enforce demo-data rules and write the
  audit trail.
- **Demo data is structurally unverifiable:** `is_demo` rows can never be `verified` (check
  constraint), and users can't set or clear the flag (trigger).

Details: [ARCHITECTURE.md](ARCHITECTURE.md), [ADR 0001](adr/0001-stack-and-tenancy.md).

## 2. Directory tree

```
.
├── .github/workflows/ci.yml         lint → typecheck → unit → RLS tests → types drift → build
├── docs/
│   ├── adr/0001-stack-and-tenancy.md
│   ├── ARCHITECTURE.md  DATA_DICTIONARY.md  SECURITY.md  SPRINT_0_1_PLAN.md
├── scripts/gen-db-types.ts          Supabase-shaped TS types from the migrated schema
├── supabase/
│   ├── config.toml                  local stack config (password policy, confirmations, MFA)
│   ├── migrations/
│   │   ├── 20261029000000_foundation.sql
│   │   └── 20261029010000_demo_data_flags.sql
│   ├── seed.sql                     synthetic fixtures incl. 76 Sunrise Avenue, Halekulani NSW
│   └── tests/supabase-shim.sql      minimal auth/storage stand-in for plain-Postgres tests
├── tests/db/                        RLS integration tests (global-setup, db helpers, fixtures)
└── src/
    ├── middleware.ts                session refresh + protected-route redirect
    ├── components/                  ui primitives, form helpers, evidence register, demo banners
    ├── lib/
    │   ├── supabase/                server + middleware clients, generated database.types.ts
    │   ├── session.ts               user, memberships, active organisation, requireOrg()
    │   ├── validation.ts (+ test)   zod schemas: auth, organisation, property, evidence
    │   ├── routes.ts                protected paths, open-redirect-safe ?next=
    │   ├── env.ts  format.ts  billing/plans.ts
    └── app/
        ├── page.tsx  pricing/       marketing
        ├── sign-in/  sign-up/  auth/{actions.ts, confirm/, sign-out/}
        ├── onboarding/  org-actions.ts
        └── (app)/                   authenticated shell
            ├── dashboard/           redirects by organisation type
            ├── investor/            dashboard, properties, property overview + evidence register
            ├── firm/                matter inbox, matter view (read-only), review queue
            └── settings/            organisation, members, plan, audit log
```

## 3. SQL schema (summary)

Full definitions: `supabase/migrations/`; column reference: [DATA_DICTIONARY.md](DATA_DICTIONARY.md).

| Table | Key columns |
| --- | --- |
| `users` | `auth_id` → `auth.users`, `display_name` |
| `organisations` | `name`, `type`, `verification_status` |
| `memberships` | (`user_id`, `organisation_id`), `role` admin/member |
| `platform_admins` | `user_id` (grants **no** data access) |
| `properties` | `owner_org_id`, `address`, `suburb`, `postcode`, `lot_dp`, `jurisdiction` (NSW), `is_demo` |
| `evidence` | `property_id`, `title`, `source_type`, `source_url` (https), `fetched_at`, `verification_status`, `verified_by/at`, `is_demo` |
| `documents` | `owner_org_id`, `property_id`, `matter_id`, `storage_key`, `mime` (PDF), `size_bytes` (≤25 MiB), `checksum`, `classification`, `scan_status` |
| `findings` | `document_id`, `category`, `extracted_text`, `page_ref`, span, `confidence`, `status`, `reviewer_id` |
| `matters` | `property_id`, `investor_org_id`, `professional_org_id`, `status` |
| `matter_access` | (`matter_id`, `user_id`), `permission` view/edit/manage |
| `tasks` | `matter_id`, `assignee_id`, `due_at`, `status`, `verified_by` |
| `scenarios`, `scenario_results` | schema only; used from Sprint 2 |
| `audit_events` | `organisation_id`, `actor_id`, `resource_type/id`, `action`, `timestamp` |
| `subscriptions` | `organisation_id`, `plan`, `status`, `stripe_customer_id` |

## 4. Security / RLS design

| Rule | Mechanism |
| --- | --- |
| Deny by default | RLS on every table; `anon` has no privileges; minimal (column-level) grants to `authenticated` |
| Organisation isolation | Policies use `app.is_member(owner_org_id)` |
| Matter-level grants | `app.has_matter_access(matter, perm)` requires an `active` matter and a grant |
| Revocation | Setting matter to `revoked` or deleting the grant removes access immediately |
| Who may grant | Investor org members, only to members of the engaged firm |
| Matter lifecycle | Transition guard trigger (e.g. revoked can't be reactivated) |
| Server-stamped fields | `created_by`, `uploaded_by`, `verified_by/at`, `reviewer_id/reviewed_at` |
| AI output immutable | Column grants + trigger (Sprint 3 ready) |
| Demo data | `is_demo` immutable for users; demo evidence can't be verified |
| Platform admins | No implicit data access |
| Audit | Trigger-written `audit_events`, admin-readable, not writable by users |
| Storage | Private bucket; object reads require document access; uploads only into own org folder |
| App layer | JWT verified with `getClaims()`, zod validation, security headers, safe redirects, POST-only sign-out with origin check |

Threat model and known gaps: [SECURITY.md](SECURITY.md).

## 5. Test strategy

| Layer | Tool | What it proves |
| --- | --- | --- |
| Database / RLS | Vitest + `pg` against PostgreSQL with a Supabase shim | For each policy, a **permitted** and a **denied** case: cross-tenant reads/writes, firm member vs granted professional, invitation vs active matter, revocation, grant rules, lifecycle transitions, server stamping, demo-data rules, audit visibility and immutability, storage paths, platform-admin isolation |
| Unit | Vitest | Validation (NSW postcodes, https-only evidence, future dates, password rules), open-redirect protection, protected-route matching |
| Static | ESLint (Next + TS), `tsc --noEmit` | Code quality, typed queries against generated DB types |
| Build | `next build` | Production compile of all routes |
| Smoke | Manual / Playwright (local) | Public pages render, security headers present, protected routes redirect to sign-in |
| CI | GitHub Actions | All of the above plus a generated-types drift check |

Each RLS test runs in a transaction that is always rolled back and impersonates a user exactly as
PostgREST does (`role authenticated` + `request.jwt.claims`). End-to-end browser tests against a
live Supabase Auth stack are planned once a staging project exists.
