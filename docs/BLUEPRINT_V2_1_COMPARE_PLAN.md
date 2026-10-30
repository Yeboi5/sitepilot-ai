# Master Blueprint v2.1: Compare My Properties (plan)

Status: **proposed, awaiting approval** (2026-10-30). Source: `SitePilot_AI_Master_Blueprint_v2_1.docx`,
"Version 2.1 — Saved Property Comparison Engine". This extends [BLUEPRINT_V2_PLAN.md](BLUEPRINT_V2_PLAN.md);
nothing already built is removed or changes meaning.

## 1. Audit: what exists today

| Area | Today (0.7.0) | What Compare can reuse | Gap for v2.1 |
| --- | --- | --- | --- |
| Swipe → save | Two decks, For Sale / Off-Market, `swipe_events`, `saved_properties` (signed in) or on-device (guests) | Saving is done; "swipe right on three DEMO properties, all appear in Saved" already passes | — |
| Saved Properties | `/saved`, Homes / Investments tabs, single list, remove, guest import | The page and its data loading | Selection checkboxes, sticky **Compare (n)** bar, 2–5 limit, grid/list toggle, filters |
| Listing data | Demo listings: price (for sale only), beds, baths, cars, land, `indicative_weekly_rent` (for-sale, built investment listings only), `development_idea` and `risk_flags` (text prompts), provenance | All dimensions that exist | Homes have no rent; off-market rows have no price or rent (by design); no licensed value, growth, hazard, zoning or commute data |
| Indicative signals | `signals-1.0.0`: gross yield only | Gross-yield formula | Net yield, cash flow, financing, multi-year projections |
| Feasibility engine | `feasibility-1.0.0` (workspace scenarios): develop-and-sell and retain-and-rent, capitalised interest, sensitivity on cost, end value and rate; tested and versioned | Development feasibility for a property that has a workspace scenario; the testing and versioning approach | No P&I loans, vacancy, management, growth, holding-period returns |
| Evidence register | Per workspace, with verification status; demo evidence can never be verified | "Development feasibility" can require **verified** planning evidence before it is scored | — |
| Duty presets | Flag only (approved for V2-6, not built) | — | Acquisition costs need state duty assumptions |
| Report export | Escaped HTML report with audit (`report_export_audit`) | Pattern for a shareable comparison report | Redacted share link |
| Vision share links | Hashed secret token, revocable, unindexed | Same pattern for comparison share links | — |
| Matterport | **Not built yet** (V2-5 was next) | — | Still to do; see sequencing below |
| Conveyancing | Firm inbox, matter view (grant-filtered), review queue, evidence, audit, session revocation | Untouched by Compare | Document vault and extraction (v1.0 Sprint 3/4) still outstanding |

## 2. Conflicts and proposed resolutions

1. **`comparison_items.property_id` vs our data.** In this app, saved items are **listings**; "properties"
   are private workspaces. Proposal: an item references exactly one of `listing_id` (saved listing) or
   `property_id` (the user's own workspace), enforced by a check constraint. No existing table changes.
2. **Data that isn't licensed** (market value, historical growth, hazard and environmental risk,
   commute, zoning). Shown as **Unknown, with the reason** ("not licensed yet" / "no route data").
   We won't invent suburb growth for real suburbs, even as demo data.
3. **Off-market homes are NOT FOR SALE.** They can be compared on features and open checks. Price-based
   metrics stay Unknown unless the user types a **hypothetical price**, which is labelled as theirs and
   never shown as a price, value or offer.
4. **Development potential.** Scored only when a linked workspace has **verified** planning evidence
   (existing evidence register). Otherwise "Insufficient evidence". Demo data can never qualify.
5. **Growth scenarios.** Conservative, base and optimistic rates are user assumptions, **identical for
   every property by default** (example values 2%, 4%, 6% p.a., labelled "examples, not forecasts"), so a
   comparison never smuggles in a per-suburb prediction.
6. **AI questions** ("highest 10-year net return?"). First as deterministic question templates computed
   by the engine; an AI narrator is added only after the numbers are tested and an AI provider key is
   approved. The AI never calculates.
7. **Advice.** Every screen: educational, pre-tax by default, not personal financial advice; tax and CGT
   are optional user inputs flagged "check with your accountant".

## 3. Engine (pure TypeScript, versioned, unit-tested)

New `src/lib/compare/`, versions `investment-1.0.0` and `score-1.0.0`, documented in FORMULAS.md.

**Inputs** (global defaults, overridable per property): price (listing or hypothetical), weekly rent
(listing assumption or user), state duty (preset or user), legal and other costs, deposit %, interest
rate, loan term, interest-only or principal-and-interest, vacancy %, management %, insurance, council
rates, strata, maintenance %, land tax, holding period (1–30 years), growth rates (3 scenarios), optional
marginal tax rate and CGT discount.

**Outputs per property:** acquisition costs (duty + other), cash required, loan, gross yield, net yield,
annual pre-tax cash flow (rent after vacancy − expenses − loan payments), interest-rate sensitivity
(±1 and ±2 pp), and for each scenario over the holding period: projected value, loan balance, equity,
unrealised capital gain, cumulative cash flow, and total return. Cash flow, equity and unrealised gains
are **reported separately**, never blended into one "profit". Missing inputs give `unknown` with a
reason, never 0.

**Investment Match Score (0–100, optional):** default weights rental return 25, affordability/cash
flow 20, development feasibility 20, historical market indicators 15, risk 15, data completeness 5; all
adjustable. Each measure maps to 0–100 through **fixed, published bands** (e.g. gross yield 2% → 0,
7% → 100), so a property's score doesn't change because of what it's compared with. A category with
insufficient evidence is **excluded** (shown as such), and the score shows its **coverage** (share of
weight actually scored). Below 60% coverage there is no overall score: "Not enough evidence to
score". Risk uses the rate stress test (cash flow at +2 pp) and the number of open checks; hazard data
is Unknown until licensed.

## 4. Screens

```
/saved                     + Select, checkboxes, grid/list, filters, sticky "Compare (n)" (2–5)
/compare?ids=a,b,c         NEW  works for guests on demo data (nothing saved)
/compare/[id]              NEW  saved comparison (signed in, owner only)
/compare/shared/[token]    NEW  redacted read-only report (secret link)
```

Comparison screen: **Homebuyer / Investor** preset toggle; summary cards (top score, best cash flow,
lowest cash required); side-by-side table on desktop, horizontally scrolling cards with a sticky
label column on mobile; charts (annual cash flow bars, projected equity lines per scenario,
interest-rate sensitivity) as accessible SVG with data tables; assumptions panel; weight sliders;
**"Why these results?"** generated deterministically from the numbers; source, as-of date and
confidence on every row. The Homebuyer preset emphasises price, cash required, repayments, features
and lifestyle tags (commute shows "Not available: no route data").

## 5. Data model (needs your approval)

**M10 `compare`** (additive):

| Table | Columns | RLS |
| --- | --- | --- |
| `comparison_sets` | id, owner_user_id (server-stamped), name, mode (`homebuyer`/`investor`), share_token_hash, shared_at, created_at, updated_at | Owner only |
| `comparison_items` | comparison_set_id, listing_id **or** property_id (exactly one), sort_order, overrides_json | Owner only; the listing must be readable and the workspace must be one the user can read; 2–5 items per set |
| `comparison_assumptions` | comparison_set_id (PK), assumptions_json, weights_json, engine_version, score_version, updated_at | Owner only; JSON validated by zod in the app and type-checked in SQL |

`comparison_results` (cache) is **not** proposed: the engine is fast and deterministic, so results are
computed on view. A share link stores a **snapshot** (inputs + outputs + versions) taken when shared, with
no workspace evidence, documents, notes or owned-property data.

**M9 `duty_presets`** (already approved for V2-6, pulled forward): state, version, brackets, source URL,
as-of date, reviewed_by. Values are entered from each state revenue office's published rates and
marked **"needs review"** until you (or an accountant) confirm them. Concessions (first home, off-the-plan,
foreign purchaser surcharges) are not modelled at first; users can override any duty figure.

## 6. Stages

| Stage | Scope | Schema | Ships behind |
| --- | --- | --- | --- |
| **C1 Engine** | `investment-1.0.0` + `score-1.0.0`, unit tests (yield, cash flow, P&I, projections, unknowns, scoring bands, weights, coverage), FORMULAS.md | none | — |
| **C2 Compare UI** | Saved selection and filters; `/compare?ids=` for guests and users; table, mobile cards, charts, assumptions, weights, "Why these results?"; browser tests incl. iPhone | none | `compare` flag |
| **C3 Save + duty** | M10 + M9, RLS tests (permitted and denied), save / rename / reopen / delete; duty presets as defaults | M10, M9 | `compare`, `dutyPresets` |
| **C4 Share report** | Redacted snapshot link (hashed token, revocable, unindexed) with disclaimers; print-friendly | M10 columns | `compare` |
| **C5 Questions** | Deterministic question templates ("highest 10-year net return under my assumptions", "best cash flow at +2% rates"); optional AI narration later, after provider approval | none | `compareAi` (off) |
| **C6 Development link** | "Analyse this deal": create a workspace from a listing, link it to the item, use its feasibility scenario and verified evidence | none | `compare` |

**Sequencing:** Compare is now core, so it goes **before** Matterport. V2-5 Matterport → after C4. Then
V2-6 Couples (duty presets already done), V2-7 professional workflows, V2-8 beta readiness.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Numbers read as forecasts or advice | Same example growth for all properties; "hypothetical" labels; separate cash flow / equity / gains; disclaimers; no "buy" language |
| Fabricated data | Unknown with reasons; no per-suburb growth; demo labels everywhere |
| Score treated as a prediction | Published bands and weights, component scores, coverage, "not enough evidence" threshold |
| Off-market homes implied for sale | No price shown; hypothetical price is labelled the user's own and never displayed as a price |
| Share links leak private data | Snapshot only of listing-level demo data and the user's assumptions; hashed, revocable tokens; no workspace data |
| Wrong duty rates | Sourced and dated presets, "needs review" until confirmed, always overridable |
| Cross-user access | Owner-only RLS on all comparison tables; tests for permitted and denied access |
