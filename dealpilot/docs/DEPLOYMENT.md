# Deployment

> Nothing has been deployed. Do not deploy publicly, enable payments, or contact real businesses
> without explicit approval.

## Staging (recommended next step)

1. **Supabase project** (Sydney region). Settings to apply in the dashboard:
   - Auth → Email: confirm email ON; minimum password length 10; custom SMTP (your email provider).
   - Auth → MFA: TOTP enrol + verify ON.
   - Auth → URL configuration: Site URL = staging URL; redirect allow-list includes `<staging>/auth/confirm`.
   - Database → Backups: enable Point-in-Time Recovery before real data.
2. Apply migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Demo staging only: regenerate and load the seed (`npm run db:seed`, then run `supabase/seed.sql`
   in the SQL editor). Never load it into production.
4. Promote an administrator: `update profiles set role = 'admin' where email = '…';` (they must enrol MFA).
5. Host the app (Vercel or any Node host) with root directory `dealpilot` and these variables:

   | Variable | Staging value |
   | --- | --- |
   | `DATA_DRIVER` | `supabase` |
   | `DEMO_MODE` | `true` for a demo project, otherwise unset |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | project values |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role key (**server only**) |
   | `NEXT_PUBLIC_APP_URL` | staging URL |
   | `MFA_REQUIRED_ROLES` | `admin` (add `business` if desired) |
   | `CLAMD_HOST`, `CLAMD_PORT` | ClamAV service (uploads are refused in production without it) |
   | `SMTP_URL`, `EMAIL_FROM` | email provider |
   | `ABR_GUID` | ABN Lookup GUID |
   | `AI_PROVIDER`, `ANTHROPIC_API_KEY` | optional |
   | `PAYMENTS_PROVIDER` | `none` |

6. ClamAV: run `clamav/clamav:stable` as a private service (not internet-exposed), with
   freshclam able to reach `database.clamav.net` for signature updates.
7. Smoke test: `GET /api/health` should report `database: ok` and `antivirus: clamav`; then run
   `BASE_URL=<staging> npm run test:e2e` against a **demo** staging project.

## Production gates

Production must not take real customers until the items in [HANDOFF.md](HANDOFF.md) "Before public
launch" and [LEGAL_REVIEW.md](LEGAL_REVIEW.md) are complete.
