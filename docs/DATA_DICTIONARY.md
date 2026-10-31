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

Personal workspaces (Update Pack 1.1): `ensure_personal_workspace()` gives a signed-in user with
no memberships an investor organisation named "‹display name›'s workspace" (they become admin, on
the Explorer plan). It's idempotent and serialised per user.

### `memberships`
PK (`user_id`, `organisation_id`). `role`: `admin` \| `member`. Admins manage members but cannot
remove/demote themselves.

## Property workspace

### `properties`
| Column | Type | Notes |
| --- | --- | --- |
| owner_org_id | uuid | Investor organisation that owns the workspace |
| address, suburb | text | As on official records |
| postcode | text | 4 digits; checked against the state's Australia Post ranges in the app |
| lot_dp | text | Lot and plan as on the title (e.g. `Lot 1 DP 123456`, `Lot 2 PS 123456`), optional |
| jurisdiction | text | `NSW`, `VIC`, `QLD`, `WA`, `SA`, `TAS`, `ACT`, `NT` (default `NSW`). Time zone derived from it |
| is_demo | boolean | Synthetic fixture. Set only by seed/service role; immutable for users |
| created_by | uuid | **server** |

### `evidence`
Official planning/title evidence. **No automated zoning claims.** Each record is attributed.
| Column | Type | Notes |
| --- | --- | --- |
| property_id | uuid | |
| title | text | |
| source_type | `evidence_source_type` | `planning_certificate`, `planning_portal`, `lep_map`, `council_record`, `title_search`, `survey`, `valuation`, `other` |
| source_url | text | Must start `https://`; either this or `document_id` required |
| fetched_at | date | Date the user retrieved it (not in the future) |
| verification_status | `evidence_status` | `unverified` (default), `verified`, `disputed`, `superseded` |
| verified_by / verified_at | uuid / timestamptz | **server**; set only when status is `verified` |
| document_id | uuid | Optional uploaded copy |
| notes | text ≤ 4000 | |
| is_demo | boolean | **server**: inherited from a demo property; demo evidence can never be `verified` |

### `scenarios`
| Column | Type | Notes |
| --- | --- | --- |
| property_id | uuid | Owning property; private to the property's organisation, even on shared matters |
| name | text (1–120) | |
| assumptions_json | jsonb | `Assumptions` (`src/lib/finance/assumptions.ts`): strategy, land, acquisition, soft, hard, contingencyPct, timeline, finance, holding, sale, rent. All investor assumptions |
| formula_version | text | Formula version at last save, e.g. `feasibility-1.0.0` |
| created_by | uuid | **server** |

### `scenario_results`
Append-only change history: one row per save, with no update or delete for users.
| Column | Type | Notes |
| --- | --- | --- |
| scenario_id | uuid | |
| result_json | jsonb | `{ assumptions, result }`, where `result` is a `FeasibilityResult` (costs, TDC, finance, sale or rent, tax basis, warnings) |
| formula_version | text | |
| calculated_at | timestamptz | |

Displayed figures are always recalculated from `scenarios.assumptions_json`; see FORMULAS.md.

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

## Discovery (Blueprint v2.0, V2-2)

Listing data, property records and user activity are kept separate (v2.0 §9).

### `property_records`
Canonical addresses. `state`, `suburb`, `postcode`, `street_address` (nullable), `source`
(`demo` / `licensed`), `is_demo` (must equal `source = 'demo'`), `gnaf_pid` (future G-NAF id).
Guests and users can read demo rows only.

### `listings`
| Column | Notes |
| --- | --- |
| kind | `home` / `investment` |
| market | `for_sale` / `off_market`. **Off-market = NOT FOR SALE**: `asking_price`, `price_display` and `street_address` must be null (constraints) |
| is_demo | Demo listings are the only ones readable today |
| property_type | `house`, `townhouse`, `apartment`, `duplex`, `land` |
| state, suburb, postcode, street_address | Display location (street address for-sale only) |
| bedrooms, bathrooms, car_spaces, land_area_sqm | |
| asking_price, price_display | For sale only; illustrative for demo |
| indicative_weekly_rent | Investment assumption (demo); used for indicative gross yield |
| development_idea, risk_flags | Prompts to check with council and professionals, not conclusions |
| lifestyle_tags | Features of the (fictional) home |
| illustration_seed | Drives the generated illustration (no photos) |
| provenance | jsonb: `source`, `licence`, `as_of`, `verification` (required `source`) |
| property_record_id | Optional link to `property_records` |

### `swipe_events`
Append-only per user: `listing_id`, `action` (`save`, `pass`, `undo`, `unsave`), `source`
(`swipe`, `button`, `keyboard`, `import`, `list`), `created_at`. `user_id` is **server**-stamped.
Rate-limited to 1,000 per user per hour.

### `saved_properties`
The current shortlist: PK (`user_id`, `listing_id`), `created_at`. Owner-only; `user_id` is
**server**-stamped.

## My Property (Blueprint v2.0, V2-3)

### `owned_properties`
A user's own home: `user_id` (**server**-stamped), optional `property_record_id` (unique per user),
`nickname`, `address`, `suburb`, `state`, `postcode`, `accepts_enquiries` (effective only once a
claim is verified). Owner-only; verifiers can read the address of homes with a pending claim.

### `property_notes`, `maintenance_items`
Owner-only notes (`body`) and checklist items (`title`, `due_on`, `done_at`).

### `claim_verifiers`
Users allowed to review homeowner claims. Managed with the service role only.

### `homeowner_claims`
`owned_property_id`, `claimant_id` (**server**-stamped), `status` (`pending`, `verified`,
`rejected`, `withdrawn`; always inserted as `pending`), `method` (`document`), `evidence_key`
/ `evidence_name` / `evidence_mime` (key cleared after the file is deleted), `declared_at`,
`decided_by`, `decided_at`, `decision_note`. One open claim per home; one verified owner per
property record. Decisions only through `decide_claim()`, audited.

### `buyer_enquiries`
`owned_property_id`, `buyer_id` (**server**-stamped), `message` (10–1000 chars, immutable),
`status` (`open`, `replied`, `declined`, `withdrawn`, `closed`; `closed` is final),
`owner_reply`. Visible to the buyer and the owner only.

## SitePilot Vision (Blueprint v2.0, V2-4)

### `visual_projects`
`user_id` (**server**-stamped), optional `owned_property_id` (must be the caller's own home),
`title`, `mode` (`birds_eye`, `exterior`, `interior`), `source_key` (re-encoded JPEG in
`vision-sources`), `source_width`, `source_height`, `rights_confirmed_at` (server-set when the
user confirms they may use the photo). Owner-only; max 50 per user.

### `visual_versions`
`project_id`, `user_id` (**server**-stamped), `preset`, `style`, `prompt` (≤ 300), `provider`,
`model`, `cost_cents`, `output_key` (`vision-outputs`), `watermarked` (always true),
`share_token_hash` (SHA-256 of the secret link token) and `shared_at` (server-set). Owner-only;
inserts need a reserved credit.

### `vision_usage`
Per user per Sydney day: `generations` reserved. Read-only to the owner; written only by
`reserve_vision_credit()`.

## Compare My Properties (Blueprint v2.1)

### `property_estimates`
Per property record: `value_low/mid/high`, optional `rent_weekly_low/mid/high`, `confidence`,
`source`, `as_of`, `is_demo`. DEMO rows only until a licensed valuation provider is contracted.
Readable by everyone (DEMO rows); written by the service role only.

### `duty_presets`
Per state and version: `brackets` (ascending `{from, base, ratePer100}`), `source_url` (official),
`as_of`, `status` (`needs_review` until `reviewed_by` / `reviewed_at`), `notes`. Reference data;
service role writes. No rows yet.

### `comparison_sets`, `comparison_items`, `comparison_assumptions`
A saved comparison: `owner_user_id` (**server**-stamped), `name`, `mode` (`homebuyer`/`investor`),
optional share (`share_token_hash`, `share_snapshot`, `shared_at`). Items: exactly one of
`listing_id` / `property_id`, `sort_order` (0–4, max 5 items), `overrides_json` (price, rent, duty,
…). Assumptions: `assumptions_json`, `weights_json`, `engine_version`, `score_version`. All owner-only.

## Suburb statistics

### `suburb_sales_stats`
Per suburb, postcode, `dwelling_type` (`house`/`unit`), optional `bedrooms`, `period_end` and
`window_months` (12): `median_price` (null only when `sales_count` is 0), `sales_count`, `source`,
`source_url`, `retrieved_at`, `status` (`fact_status`: verified/reported/estimated/unverified),
`is_demo`. Public read; service-role write.

### `suburb_rent_stats`
Per suburb, postcode, dwelling type, optional bedrooms and quarter end: `median_rent_weekly`,
`bonds_count`, plus the same provenance columns.

## Official area statistics

### `official_area_stats`
Published government statistics, first the NSW Rent and Sales Report (DCJ, CC BY 4.0): `dataset`
(`nsw_dcj_sales`/`nsw_dcj_rent`), `state`, `area_type` (`postcode`/`lga`), `area_code`, `category`
(as published), `dwelling_type` (all/house/unit/townhouse/other), `bedrooms` (as published),
`period_start`/`period_end` (quarter), `q1`, `median`, `q3`, `mean`, `count` (null when withheld),
`count_note` (exact / 30_or_fewer / 10_or_fewer; no median or count when 10 or fewer),
`change_quarterly`, `change_annual` (as published), `bonds_held`, `source_url`, `licence`,
`retrieved_at`, `status` (reported). Public read; service-role write (loader).

## Platform

### `audit_events`
Append-only, written by triggers and by `record_report_export()` (action `report.exported`, metadata `{format: "view" | "html"}`). `organisation_id`, `actor_id`, `resource_type` (table name),
`resource_id`, `action` (`insert`/`update`/`delete`), `metadata` (`changed` column list for
updates; values are not copied), `timestamp`. No FKs. Readable by org admins only.

### `subscriptions`
One per organisation. `plan` (`explorer`, `investor_pro`, `developer`, `conveyancer`),
`status` (`trialing`, `active`, `past_due`, `canceled`), `stripe_customer_id`,
`current_period_end`. Written only by the billing webhook (service role).
