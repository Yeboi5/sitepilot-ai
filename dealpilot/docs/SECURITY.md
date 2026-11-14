# Security, reliability and operations

## Controls in place (Phase 2)

| Area | Control | Where | Tested |
| --- | --- | --- | --- |
| Authentication | Supabase Auth; email confirmation required; passwords ≥ 10 chars; generic sign-in errors; no account enumeration on sign-up | `lib/auth/session.ts`, `app/actions/auth.ts`, `supabase/config.toml` | Integration (real GoTrue + Mailpit) |
| MFA | TOTP enrolment and AAL2 enforcement; mandatory for roles in `MFA_REQUIRED_ROLES` (default `admin`) | `app/mfa/*`, `requireUser()` | Integration (real TOTP codes) |
| Sessions | httpOnly, SameSite=Lax, Secure in production; JWT validated with Auth on every request (`getUser`, not `getSession`) | `lib/supabase/server.ts`, `middleware.ts` | Smoke test |
| Roles | Sign-up can only create customer/business (DB trigger); admins are promoted in SQL | migration `…phase2_foundation.sql` | Integration |
| Authorisation | Ownership and role checks in every service; businesses get redacted views | `lib/services/*`, `domain/permissions.ts` | Unit |
| Database access | Server uses the service role; RLS gives clients read-only access to their own rows, hides `password_hash`, negotiations and member lists; RPCs not callable by clients | migrations | Integration (real JWTs) |
| Integrity | Guarded, row-locked, all-or-nothing writes (`apply_batch`); optimistic concurrency on negotiations; append-only, idempotent ledger and audit; savings and fee CHECK constraints | migrations, `store/*`, `services/transactions.ts` | Unit + integration (concurrent requests) |
| Rate limiting | Postgres-backed fixed windows shared by all instances: sign-in, sign-up, MFA, uploads, AI calls, external pricing, data export | `services/rate-limit.ts`, `rate_limit_hit()` | Unit + integration |
| Uploads | Allow-listed types, magic-byte check, 8 MB, malware scan before storage (ClamAV `clamd`), fail-closed, private owner-scoped Storage, served only as attachments | `services/documents.ts`, `integrations/scanner.ts` | Unit + integration (real ClamAV) |
| AI | Keys server-only; documents/negotiation data go to the AI provider only with the user's consent; document text fenced as data; prices never taken from model output; prompts never logged | `ai/*`, `services/context.ts#aiFor` | Unit |
| Privacy | Data export (APP 12), account deletion with anonymisation, retained financial records | `services/privacy.ts`, `/api/account/export` | Unit + integration |
| Headers | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (production) | `next.config.mjs` | Manual |
| Monitoring | `/api/health` (DB, AI, email, antivirus, payments state — no secrets); JSON structured logs | `app/api/health`, `lib/log.ts` | Manual |
| Payments | Disabled; unknown providers throw | `integrations/payments.ts` | Unit |

**Known gaps**: CSP allows `'unsafe-inline'` scripts (nonce-based CSP is a follow-up); rate limiting by IP depends on the hosting platform's `x-forwarded-for`; no WAF/bot protection yet; no automated dependency scanning in CI yet.

## Monitoring

- Uptime check on `GET /api/health` (expects HTTP 200 and `"status":"ok"`). Alert if `antivirus` reports
  `REQUIRED BUT MISSING` — uploads are being refused.
- Ship JSON logs to the platform's log drain. Alert on `action.unexpected_error`, `document.scan_error`,
  `ai.call_failed` spikes, and on any `document.blocked_infected`.
- Supabase: enable database and Auth log retention; alert on failed sign-in spikes and on RLS errors.
- Error tracking (e.g. Sentry) is a recommended addition; never send request bodies or documents to it.

## Backups and restore

Supabase (Pro plan or above) provides daily backups; enable **Point-in-Time Recovery** for production
so data can be restored to any second within the retention window.

1. **Before every migration** in production: take a manual backup (Dashboard → Database → Backups) and
   apply migrations to staging first.
2. **Storage** (documents) is not covered by database backups. Schedule a daily copy of the `documents`
   bucket to separate, access-controlled object storage (S3-compatible API), retained for 30 days.
3. **Quarterly restore drill**: restore the latest backup into a scratch project, run
   `npm run test:integration` against it, and record the time taken.
4. Ledger and audit tables are append-only; a restore must never be "fixed" by editing them. Reconcile
   by adding compensating ledger entries.

## Incident response (summary)

1. Contain: suspend affected businesses/accounts (admin UI), rotate keys (Supabase service role,
   `ANTHROPIC_API_KEY`, `SMTP_URL`, `SESSION_SECRET`).
2. Assess with the audit log and Supabase logs.
3. Notify: under the Notifiable Data Breaches scheme, eligible breaches must be reported to the OAIC and
   affected individuals as soon as practicable. Get legal advice early.
4. Record the incident and remediation.
