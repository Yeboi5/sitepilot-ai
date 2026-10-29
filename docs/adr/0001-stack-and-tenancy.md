# ADR 0001: Application stack and tenancy model

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

SitePilot AI is a two-sided platform (investors ↔ licensed conveyancers) handling confidential
property and legal documents. The blueprint requires organisation isolation, matter-level grants,
revocation, audited access and deny-by-default policies, with a small team shipping in sprints.

## Decision

1. **Single Next.js (App Router) + TypeScript application** with modular folders
   (`src/lib/*` services, `src/app/*` routes). A monorepo is unnecessary until a second deployable
   (e.g. a document-processing worker) exists.
2. **Supabase** for PostgreSQL, Auth and private Storage. **Row-level security is the primary
   authorisation layer.** The web app talks to the database only with the signed-in user's JWT;
   there is no service-role client in the request path. Server actions validate input (zod) and
   take the organisation from the server-side session, never from the form.
3. **Tenancy model:** every row belongs (directly or via its parent) to an owning organisation.
   Professionals reach client data only through an **active matter** *and* an explicit
   **matter_access** grant. Revoking either removes access.
4. **Privileged logic lives in SQL** (`app` schema `SECURITY DEFINER` helpers, triggers for audit
   and server-stamped fields), so the guarantees hold for every client: web, future mobile, scripts.
5. **RLS is tested** against plain PostgreSQL with a minimal Supabase shim (`supabase/tests`),
   so CI needs no Docker. Each policy has permitted *and* denied test cases.
6. **Financial calculations** (Sprint 2) will be deterministic pure TypeScript with a
   `formula_version` stored alongside every result.
7. **AI provider** (Sprint 3) sits behind a provider-agnostic interface; findings are stored
   separately from raw evidence and require professional review.

## Consequences

- Authorisation logic is concentrated in one reviewed, tested migration set rather than spread
  across route handlers.
- Supabase's default privileges grant new tables to `anon`/`authenticated`; **every new migration
  must revoke/grant explicitly and enable RLS** (see SECURITY.md checklist).
- Hand-written component primitives (`src/components/ui.tsx`) are used for now; adopt an
  accessible library (e.g. Radix-based shadcn/ui) when interactive widgets (dialogs, menus,
  comboboxes) are needed in Sprint 2+.
- Australian data residency: choose the Supabase Sydney region (`ap-southeast-2`) and confirm
  provider contractual terms before any real client data (stop/go gate).
