# Security

SitePilot AI will hold confidential property, financial and legal documents. This document is the
threat model, the list of controls in place, and the gates that must pass before real client data.

> **Stop/go:** no real client legal documents until privacy, security and professional-workflow
> review is complete (blueprint §11). Use only the synthetic data in `supabase/seed.sql`.

## Assets

| Asset | Sensitivity |
| --- | --- |
| Contracts, title searches, certificates (documents + storage objects) | Confidential; may be privileged |
| AI findings and professional review notes | Confidential |
| Feasibility scenarios and assumptions | Commercially sensitive (investor-only) |
| Identity: emails, names, memberships | Personal information (Privacy Act 1988) |
| Audit trail | Integrity-critical |

## Actors and trust boundaries

- **Guest:** marketing pages only.
- **Investor member:** their organisation's properties, evidence, scenarios, documents and matters.
- **Firm member / administrator:** sees firm-owned matter metadata; client files **only** with an
  explicit grant on an **active** matter. Firm admins accept or decline invitations.
- **Platform administrator:** operational metadata only. **No implicit access** to client data
  (tested). Any support access must be a time-boxed, audited grant (to be designed).
- **AI pipeline (service role, Sprint 3):** writes findings; never runs in the browser.
- Boundaries: browser ↔ Next.js server ↔ Supabase (PostgREST/Auth/Storage) ↔ AI provider.

## Threat model (STRIDE summary)

| Threat | Example | Control | Status |
| --- | --- | --- | --- |
| Spoofing | Stolen password | Supabase Auth, 12+ char passwords, email confirmation, auth rate limits; **MFA required for professionals** | MFA enforcement: Sprint 3 gate |
| Spoofing | Forged JWT / session | `getClaims()` verifies JWT server-side; never trust `getSession()` on the server | ✅ |
| Spoofing | Access token reused after sign-out | `app.current_user_id()` requires the JWT's `session_id` to be live in `auth.sessions`; every policy denies a revoked or expired session | ✅ tested (DB + live stack) |
| Tampering | Client edits `created_by`, `verified_by`, `reviewer_id` | Server-stamped by triggers | ✅ tested |
| Tampering | Reviewer rewrites AI-extracted text | Column-level grants + immutable-field trigger | ✅ tested |
| Tampering | Reactivating a revoked matter | Transition guard trigger | ✅ tested |
| Repudiation | "I didn't change that" | Trigger-written `audit_events`; users cannot insert/delete | ✅ tested |
| Info disclosure | Cross-tenant reads (IDOR) | RLS on every table, deny by default; 404 instead of 403 | ✅ tested |
| Info disclosure | Firm staff browsing all client files | Matter grants per user, active-matter check | ✅ tested |
| Info disclosure | Public storage links | Private bucket, storage RLS, short-lived signed URLs from server routes | Bucket + RLS ✅; signed URLs Sprint 3 |
| Info disclosure | Secrets in client bundle | Only `NEXT_PUBLIC_*` in `src/lib/env.ts`; lint rule against service-role env in app code | ✅ |
| Info disclosure | Prompt injection exfiltrates data | Document text treated as untrusted data; no tools/URLs in extraction calls; schema-validated output | Sprint 3 |
| DoS | Large/malicious uploads | 25 MiB, PDF-only at bucket + table; malware scan before processing | Limits ✅; scan Sprint 3 |
| Elevation | Self-granting matter access or admin role | Grants only by investor org to engaged firm's members; admin-only membership writes | ✅ tested |
| Misrepresentation | Demo/synthetic data presented as official | `is_demo` flag, never-verified constraint, UI badges/banners, `.invalid` URLs | ✅ tested |
| Elevation | Self-verifying a firm | `verification_status` not client-writable | ✅ tested |

## Controls in place (Sprint 0/1)

**Database (`supabase/migrations`)**
- RLS enabled on all tables; `anon` has no table privileges; `authenticated` gets explicit,
  minimal (sometimes column-level) grants.
- Policy helpers are `SECURITY DEFINER` with `search_path = ''`, in a private `app` schema not
  exposed through the API.
- Session revocation: a request is authenticated only while its `session_id` exists in
  `auth.sessions` and is within `not_after`, so sign-out, admin revocation and password changes
  take effect at the database immediately, not when the token expires.
- Organisation creation only via `create_organisation()` RPC (caller becomes admin).
- Admins cannot remove or demote themselves (prevents orphaned organisations).
- Evidence URLs must be `https://`; documents limited to PDF ≤ 25 MiB with SHA-256 checksum.
- Audit trail has no FKs, so it outlives deleted rows.

**Application**
- Security headers: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer, permissions
  policy; `X-Powered-By` removed.
- Middleware refreshes sessions and redirects unauthenticated users; `Cache-Control: private, no-store`.
- Open-redirect protection on `?next=` (`safeNextPath`).
- Server Actions (built-in Origin check) for mutations; sign-out is POST-only with an Origin check.
- All input validated with zod; generic auth errors (no account enumeration).
- External evidence links open with `rel="noopener noreferrer nofollow"`.
- Active-organisation cookie is a preference only, honoured only if the user is a member.

## Known gaps / follow-ups

- CSP uses `'unsafe-inline'` for scripts (Next.js bootstrap). Move to nonce-based CSP.
- If a browser-side Supabase client is introduced, add the Supabase URL to `connect-src`.
- MFA (TOTP) is enabled in `supabase/config.toml` but not yet *enforced*; enforce `aal2` for
  professional organisations in RLS (`auth.jwt() ->> 'aal'`) before client documents are opened.
- Application-level rate limiting for future AI/document endpoints.
- Read-access auditing (document views/downloads) via signed-URL route (Sprint 3).
- Backups, PITR, DR runbook; separate staging/production projects; secret rotation.
- Sentry with PII scrubbing.

## New-table checklist (every migration)

1. `alter table … enable row level security;`
2. `revoke all on … from anon, authenticated;` then grant only what policies need.
3. Policies for select/insert/update/delete as needed. Absent policy = denied.
4. Stamp authorship / reviewer fields in triggers, never from client input.
5. Add an `audit_row` trigger.
6. Add **permitted and denied** tests in `tests/db/`.
7. Regenerate types: `npm run db:types`.

## Compliance gates (before real client data)

- Legal review: NSW conveyancing and legal practice rules, referral disclosure, Australian Consumer
  Law, professional obligations, Privacy Act / APPs, retention.
- Explicit consent and documented purpose for AI processing; privileged/confidential handling.
- Planning data licensing and access rights verified before any commercial API ingestion.
- Out of scope permanently for MVP: client funds/trust money, settlement instructions, bank detail
  changes, automated lodgement or title transfers.

## Reporting

Report vulnerabilities privately to the maintainers; do not open public issues for security bugs.
