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
| Info disclosure | Guests reading data | The only anonymous-readable rows are DEMO `listings` and `property_records` (RLS `is_demo`); every other table denies `anon` | ✅ tested |
| Misrepresentation | Off-market homes shown as for sale, or owners identified | DB constraints: no price or street address on off-market rows; NOT FOR SALE labels; no owner data stored | ✅ tested |
| DoS / abuse | Swipe spam | 1,000 swipe events per user per hour (trigger) | ✅ tested |
| Tampering | Guest storage tampered with | On-device decisions are parsed defensively; imports accept only visible listing ids | ✅ unit-tested |
| Elevation | Self-verified homeowner claims | Claims are always inserted as `pending`; only verifiers (`claim_verifiers`, service-role managed) can decide, never their own; one verified owner per address | ✅ tested |
| Info disclosure | Ownership evidence leaks | Private `claim-evidence` bucket, own-folder uploads, verifier reads only while pending or decided by them; each view audited; served as attachment with `nosniff`; deleted after decision | ✅ tested |
| Tampering | Fake documents | File signature check (PDF/JPEG/PNG), 10 MB limit, owner declaration, human review | ✅ |
| Info disclosure | Buyers identifying off-market owners | Enquiry target is an opaque id; buyers can't read owner rows; owners see "A SitePilot member"; contact details rejected in messages | ✅ tested |
| DoS / abuse | Enquiry spam / harassment | Verified + opted-in owners only; 5 per buyer per day; no self-enquiries; opting out closes open enquiries | ✅ tested |
| Info disclosure | Location leaked from photo metadata | Uploads re-encoded server-side; EXIF (GPS, camera serials) dropped; originals never stored | ✅ tested |
| Info disclosure | Private photos exposed by sharing | Share links expose one watermarked output via `shared_vision`; token stored as SHA-256 only; links unindexed, no-referrer, revocable; sources never shared | ✅ tested |
| Misrepresentation | AI concepts mistaken for plans or approvals | AI CONCEPT mark burned into every output by SitePilot (not the provider); `watermarked` can't be false; disclaimers on every view | ✅ tested |
| DoS / cost | Runaway image-generation spend | Credit reserved before each provider call (10/day); versions can't be stored without one; 50 projects per user; 15 MB / 50 MP input limits | ✅ tested |
| Tampering | Malicious image files | Signature check, decode in sharp with a pixel limit, re-encode to JPEG; served only from our re-encoded copy with `nosniff` | ✅ |
| Info disclosure | Comparisons read by other users | Owner-only RLS on sets, items and assumptions; items may only reference listings or workspaces the caller can read | ✅ tested |
| Info disclosure | Share links leak private data | Frozen snapshot of suburb-level, listing-level facts and the sharer's assumptions only; no street address, notes, documents or workspace evidence; hashed token; revocable; unindexed | ✅ tested |
| Misrepresentation | Comparison figures read as forecasts, prices or advice | Example assumptions identical for every property; estimates labelled "not a price"; Unknown instead of guesses; score bands and coverage published; disclaimers | ✅ tested |
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
- `STORAGE_DRIVER=local` bypasses Storage RLS (DB checks still run); it throws when `VERCEL_ENV`
  is set. Claim evidence is not yet malware-scanned (shared with the Sprint 3 scanner).
- Vision: a real provider needs a data-processing review (overseas disclosure, retention, training
  use) before any photo leaves SitePilot. Credits aren't refunded when a provider call fails.
- Deleting a user account cascades rows but not storage objects; add a cleanup job.

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
