# Architecture

DealPilot is a **modular monolith**: one Next.js 15 (App Router) application, with four layers that
depend only downwards.

```
src/app/                 Pages (server components) and server actions — UI and form parsing only
src/lib/services/        Use cases: authorisation, state transitions, ledger, audit, notifications
src/lib/domain/          Pure TypeScript rules: money, categories, savings, negotiation, offers, groups,
                         monitoring, guardian, permissions. No I/O; fully unit-tested
src/lib/store/ ai/ auth/ Adapters: persistence (memory | Supabase), AI (mock | Anthropic), sessions
```

Every service function takes `(ctx, actor, …)`. `ctx` holds the store, the AI provider, fee config and
a clock, so tests build it by hand (`tests/helpers.ts`) and the app builds it per request
(`services/app-context.ts`).

## One engine for every category

All categories share the same accounts, requests, offers, negotiations, transactions and ledger.
`src/lib/domain/categories.ts` is the only category-specific code: each definition provides
fields (validated generically), comparison weights, licence/insurance requirements, negotiation
levers, a completion label and consumer notes. Adding a category is one object in that list.

## Negotiation state machine

```
open ─DRAFT_ACTION→ awaiting_approval ─SEND→ awaiting_counterparty ─RECEIVE_COUNTER→ counter_received
  │                       │                        │                                    │
  └──────────────── ESCALATE → escalated ←─────────┴────────────────────────────────────┘
any active state ─ACCEPT→ agreed ─COMPLETE (verification)→ completed
                 ─REJECT/CANCEL/EXPIRE→ declined | cancelled | expired   (no saving, no fee)
```

Transitions are a table in `domain/negotiation.ts`; anything else throws. Permission modes:

| Mode | What the AI may do |
| --- | --- |
| Advisory | Add a recommendation and suggested wording. Never sends. |
| Approval | Prepare a draft (`pendingApproval`). Sent only after the customer ticks "I approve" (they can edit it first). |
| Limited Autopilot | Send/accept only if the counterparty is simulated, the amount is within the customer's per-action limit, and an accept is at or below target. Otherwise it falls back to Approval and says why. Every autonomous action is audit-logged. |

Businesses see a **redacted** negotiation: no customer target, no AI analysis, no drafts.

## Money and savings integrity

- All amounts are integer cents (`bigint` in SQL). Parsing rejects more than 2 decimals.
- `savings = max(baseline − final, 0)` per period; annualised ×52/12/4/1. Enforced in code **and**
  by `CHECK` constraints.
- A transaction is created as `pending_verification` when a deal is agreed. Savings count, and the
  fee is calculated, only when the customer confirms the **final invoiced amount**. Savings are
  recalculated from that amount, so an invoice that comes in higher reduces the saving.
- Fee = `min(SUCCESS_FEE_CENTS, saving)`, only for verified savings. Unsuccessful or cancelled deals
  cost nothing.
- The ledger is append-only (DB trigger, memory-store guard) and every entry has a unique
  idempotency key (`fee:<txId>`), so a retried request can't charge twice.

## Data model

See `supabase/migrations/20261113000000_dealpilot_core.sql`. Tables: `categories`, `profiles`,
`businesses`, `documents`, `purchase_requests`, `offers`, `negotiations` (messages as jsonb),
`purchasing_groups` (tiered offers as jsonb), `price_watches` (history as jsonb), `alerts`,
`expense_lines`, `transactions`, `ledger_entries`, `audit_logs`.

## Security

- **Sessions:** HMAC-SHA256 signed, httpOnly, SameSite=Lax, 8-hour cookies; constant-time
  comparison. Passwords use scrypt. Sign-in errors don't reveal whether an email exists.
- **Authorisation:** role and ownership checks in every service (`domain/permissions.ts`); covered
  by tests. Middleware only redirects signed-out users — it is not the security boundary.
- **Mutations** are server actions (built-in origin checks). Open redirects are blocked.
- **Uploads:** allow-listed types, magic-byte sniffing, 8 MB limit, owner-scoped storage keys,
  served only through an authenticated route as `attachment` with `nosniff` and `no-store`.
- **Supabase:** the server uses the service role; RLS gives clients read-only access to their own rows,
  hides `password_hash`, negotiations and group member lists, and limits Storage to the user's folder.
- **AI:** keys are server-only; document text is fenced and treated as data; prices are never taken
  from model output.
- **Money Guardian** never asks for bank credentials and rejects CSV rows that look like account numbers.
- Security headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
