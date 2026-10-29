# Data dictionary

Source of truth: `supabase/migrations/`. TypeScript types: `src/lib/supabase/database.types.ts`
(regenerate with `npm run db:types`). All ids are UUIDs unless noted; timestamps are `timestamptz`.

Columns marked **server** are set by triggers and can't be supplied by clients.

## Identity and tenancy

### `users`
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Profile id used across the schema |
| auth_id | uuid | → `auth.users.id`, unique; created by `on_auth_user_created` trigger |
| display_name | text (1–120) | Only user-editable column |
| created_at | timestamptz | |

### `platform_admins`
Operational staff. **Grants no data access** by itself. Service-role managed.

### `organisations`
| Column | Type | Notes |
| --- | --- | --- |
| name | text (1–160) | Editable by org admins |
| type | `organisation_type` | `investor` \| `professional` |
| verification_status | `verification_status` | `unverified`, `pending`, `verified`, `rejected`. Platform-managed (manual credential checks in pilot) |

### `memberships`
PK (`user_id`, `organisation_id`). `role`: `admin` \| `member`. Admins manage members but cannot
remove/demote themselves.

## Property workspace

### `properties`
| Column | Type | Notes |
| --- | --- | --- |
| owner_org_id | uuid | Investor organisation that owns the workspace |
| address, suburb | text | As on official records |
| postcode | text | 4 digits (NSW validated in app) |
| lot_dp | text | e.g. `Lot 1 DP 123456`, optional |
| jurisdiction | text | `NSW` only during pilot |
| created_by | uuid | **server** |

### `evidence`
Official planning/title evidence. **No automated zoning claims.** Each record is attributed.
| Column | Type | Notes |
| --- | --- | --- |
| property_id | uuid | |
| title | text | |
| source_type | `evidence_source_type` | `planning_certificate`, `planning_portal`, `lep_map`, `council_record`, `title_search`, `survey`, `other` |
| source_url | text | Must start `https://`; either this or `document_id` required |
| fetched_at | date | Date the user retrieved it (not in the future) |
| verification_status | `evidence_status` | `unverified` (default), `verified`, `disputed`, `superseded` |
| verified_by / verified_at | uuid / timestamptz | **server**; set only when status is `verified` |
| document_id | uuid | Optional uploaded copy |
| notes | text ≤ 4000 | |

### `scenarios` / `scenario_results` (Sprint 2)
`assumptions_json` and `result_json` are versioned by `formula_version`. Private to the investor
organisation, even when a matter is shared.

## Documents and AI findings

### `documents`
| Column | Type | Notes |
| --- | --- | --- |
| owner_org_id | uuid | Uploading (client) organisation |
| property_id / matter_id | uuid | Optional links; professionals see a document only if `matter_id` is set and they hold a grant |
| storage_key | text | `<owner_org_id>/<document_id>.pdf` in the private `documents` bucket |
| mime | text | `application/pdf` only |
| size_bytes | bigint | ≤ 25 MiB |
| checksum | text | SHA-256 hex |
| classification | `document_classification` | `contract_for_sale`, `title_search`, … |
| scan_status | `document_scan_status` | `pending` → `clean` / `infected` / `rejected` |
| uploaded_by | uuid | **server** |

### `findings`
AI-extracted issues, never legal conclusions.
| Column | Type | Notes |
| --- | --- | --- |
| document_id | uuid | |
| category | text | e.g. `settlement_period`, `special_condition` |
| extracted_text | text | Verbatim span; immutable after insert |
| page_ref | int ≥ 1 | Source page |
| span_start / span_end | int | Character offsets within the page text |
| confidence | numeric(4,3) | 0–1 |
| status | `finding_status` | `unreviewed`, `needs_clarification`, `confirmed`, `rejected` |
| reviewer_id / reviewed_at | uuid / timestamptz | **server** |
| reviewer_note | text | |
| ai_model | text | Model/prompt version for provenance |

Inserted only by the AI pipeline (service role). Only professionals with `edit` on the
document's active matter may update `status` / `reviewer_note`.

## Matters

### `matters`
`property_id`, `investor_org_id`, `professional_org_id`, `status` (`invited`, `active`,
`declined`, `revoked`, `closed`; see ARCHITECTURE.md lifecycle), `created_by` (**server**).

### `matter_access`
PK (`matter_id`, `user_id`). `permission`: `view` < `edit` < `manage`. Granted by the investor
organisation to members of the engaged firm only.

### `tasks`
`matter_id`, `title`, `assignee_id`, `due_at`, `status` (`open`, `in_progress`, `done`,
`cancelled`), `verified_by`, `created_by` (**server**).

## Platform

### `audit_events`
Append-only, trigger-written. `organisation_id`, `actor_id`, `resource_type` (table name),
`resource_id`, `action` (`insert`/`update`/`delete`), `metadata` (`changed` column list for
updates; values are not copied), `timestamp`. No FKs. Readable by org admins only.

### `subscriptions`
One per organisation. `plan` (`explorer`, `investor_pro`, `developer`, `conveyancer`),
`status` (`trialing`, `active`, `past_due`, `canceled`), `stripe_customer_id`,
`current_period_end`. Written only by the billing webhook (service role).
