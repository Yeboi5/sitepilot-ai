# Deployment

## Demo deployment (memory driver)

Any Node host works. The in-memory store lives in one server process, so use a **single long-running
instance** (e.g. a container, Railway, Fly.io, Render). On serverless platforms each instance has its
own copy of the demo data, which resets on cold starts.

```bash
cd dealpilot
npm ci && npm run build
SESSION_SECRET="$(openssl rand -base64 48)" npm start   # port 3000
```

## Production (Vercel + Supabase)

1. **Supabase project** (Sydney region for Australian data residency).
   - Run `supabase/migrations/*.sql` in order (SQL editor, or `supabase db push`).
   - Confirm the private `documents` bucket exists and has an 8 MB limit.
   - Don't load `seed.sql` into production.
2. **Vercel project** with root directory `dealpilot`. Environment variables:

   | Variable | Value |
   | --- | --- |
   | `DATA_DRIVER` | `supabase` |
   | `SESSION_SECRET` | 48+ random bytes, base64 |
   | `NEXT_PUBLIC_SUPABASE_URL` | project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role key (**server only**) |
   | `AI_PROVIDER` / `ANTHROPIC_API_KEY` / `AI_MODEL` | `anthropic`, key, `claude-opus-5-5` |
   | `SUCCESS_FEE_CENTS` / `FEE_CURRENCY` | `150` / `AUD` |

3. Set the server-action body limit to the upload limit (already 10 MB in `next.config.mjs`).
4. Smoke test with `BASE_URL=https://… npm run test:e2e` against a **staging** project seeded with
   `seed.sql`. Never run it against production.

## Before real customers use it

The prototype is not production-ready until the "Production gates" in [ROADMAP.md](ROADMAP.md) are
done. In particular: real payments, business verification, Supabase Auth with email verification
and MFA, rate limiting, malware scanning of uploads, monitoring, and legal review of fee disclosure
and the AI-negotiation terms.
