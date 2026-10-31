# Flagship Property Investment Intelligence Upgrade: audit and plan

Status: **approved 2026-10-30** (all recommendations in section 6). Stage 2a ✅ (0.12.0); suburb profiles steps 1–3 ✅ with DEMO figures (0.13.0); next: real NSW figures (step 4, needs network access) and 2b. Source: the "Flagship Property Investment
Intelligence Upgrade" brief. This upgrades the existing app (0.11.0); nothing is rebuilt and no
working feature is removed.

## 1. Audit: what exists today

| Brief area | Already built (keep) | Refine | Missing |
| --- | --- | --- | --- |
| Discover → swipe/save | Two decks, For Sale / Off-Market (NOT FOR SALE), swipe/buttons/keys/undo, guest + synced saves, area search (towns/postcodes), price/type/rooms/land/yield filters, sort | — | Asset classes beyond house/townhouse/apartment/duplex/land (rural acreage, commercial, mixed-use, development site) |
| Saved | List/grid, filters, select 2–5, sticky Compare bar, saved comparisons list | Check the Compare bar and bottom nav never overlap on every page | — |
| Quick Compare | Cards: picture (illustration), price/estimate, repayments, rent and yield, priorities → best match with plain-English reasons | Price per m², land/building area, development and risk lines, confidence badges, expandable "why", **only highlight a leader when evidence is sufficient** (today it always picks one) | Photos (need licensed images or user uploads) |
| Advanced Compare | Side-by-side table with sticky labels and sideways scroll on mobile, per-property overrides, assumptions, P&I/IO, rent/yield/cash flow, rate stress, 3 growth scenarios over a holding period, equity chart, score with weights and coverage, "Why these results?", question templates, save/share/delete | Group into the brief's sections A–G; 5/10/15-year side by side; add/remove/replace properties in place | Comparable sales, sales history, market value, growth indicators, zoning/overlays/frontage/FSR, hazard data, exit strategies |
| Financial engine | `investment-1.0.0` (yields, costs, loans, cash flow, projections, equity, net return), `feasibility-1.0.0` (develop and sell / retain and rent, capitalised interest, sensitivity), tested and versioned | Extend rather than replace: LVR, selling costs and net sale proceeds, cash-on-cash, annualised return, renovation, refinance; keep cash flow / equity / gains / development profit separate | Exit strategies; after-tax estimates (labelled, optional) |
| Score | `score-1.0.0`: 6 categories, fixed bands, adjustable weights, missing data excluded with coverage, 60% threshold | Move to the brief's 7 components with strategy presets and auto-normalised sliders; **risk shown explicitly, not averaged away** | Capital growth and location fundamentals inputs (need data) |
| Development | Workspace link ("Analyse this deal"), verified official planning evidence + complete scenario required (C6) | Type-aware feasibility status per exit strategy | Zoning/controls facts, indicative yield |
| Provenance | Listing provenance JSON, estimate source/as-of/is_demo, evidence register with verification, DEMO labels everywhere, Unknown-with-reason | One consistent model for every fact: Verified / Reported / Estimated / Unverified + source, date, confidence, limitations | A per-fact store (below) |
| Workspace | Investor workspace: evidence register, scenarios, report export (HTML), matters with conveyancers; My Property notes and checklist | Comparison history, source links list, due-diligence checklist by asset class | Documents vault (v1.0 Sprint 3, still outstanding) |
| AI analyst | Deterministic "Why these results?" and question answers | — | Structured per-property report (brief §5) |
| Manual add | Search Any Address (demo index) → My Property / Analyse | — | Add by listing URL (link only, no scraping), add to comparison |
| Tracking | — | — | Price/listing change history (needs a licensed feed) |
| Export | Shareable comparison snapshot link; workspace report HTML | Print-friendly comparison report | PDF |
| Elsewhere | My Property, claims, enquiries, Vision (mock provider), conveyancer workspaces, Matterport flag (not built) | Untouched | — |

## 2. Recommended architecture

```
Sources (licensed APIs · official planning services · user entries · DEMO)
      │  adapters (one per provider, server-only, behind feature flags and keys)
      ▼
property_records (canonical) ── property_facts (one row per fact, with provenance)
      │                              status: verified | reported | estimated | unverified
      │                              source, source_url, effective_date, retrieved_at,
      │                              confidence, limitations, is_demo
      ▼
Fact pack (typed, per property, per asset class)
      ▼
Deterministic engines (pure TS, versioned, unit-tested)
  finance · exit strategies · growth indicators · risk · score-2 · due-diligence checklist
      ▼
Analyst (stage 4): template analyst (no AI key) → optional LLM narrator that may only
rephrase the fact pack and engine outputs, with every claim citing fact ids
      ▼
UI: Quick / Advanced Compare · property analysis · workspace · report
```

- **One fact store, not more columns.** Zoning, overlays, frontage, dwelling entitlement, flood
  category, sales, rent appraisals and so on become rows in `property_facts`. Engines read facts and
  say which fact (and status) every output came from. Missing facts stay Unknown.
- **Asset class** on records and listings: `residential`, `vacant_land`, `rural`, `commercial`,
  `mixed_use`, `development_site`. Each class has a checklist of facts that matter (e.g. vacant
  land: zoning, dwelling entitlement, minimum lot size, access, services, slope, flood, bushfire).
  The checklist drives completeness, the due-diligence list and which exit strategies apply.
- **Risk is a gate, not an average.** Verified severe risks (e.g. high flood hazard) are shown as
  separate flags and cap or block the leader highlight; unknown risks are listed as open questions.
- **Leader only with evidence.** A property is highlighted only if its score has enough coverage
  *and* beats the next by a clear margin; otherwise: "Not enough verified information to rank this
  property reliably."

## 3. Data integrations and credentials

| Need | Candidates | What you'd need to provide | Until then |
| --- | --- | --- | --- |
| Listings, photos, price changes | Domain API, REA (partnership), PropTrack | Commercial agreement + API key | DEMO listings, illustrations, manual entry, user photos |
| Sales history, comparable sales, AVMs | PropTrack, Cotality (CoreLogic), Pricefinder, Domain | Commercial agreement + API key | "Unknown: no licensed sales data" |
| Addresses | G-NAF (Geoscape, open data) | Download/licence acceptance; network access | Demo index |
| Zoning, controls, heritage (NSW) | NSW Planning Portal spatial services, NSW Spatial Services (cadastre) | Network access; licence check (mostly open) | Manual evidence register |
| Planning (VIC) | Vicmap Planning / VicPlan | Network access | Manual |
| Flood, bushfire | NSW Planning Portal (bushfire-prone land), council flood studies, VIC overlays | Network access; per-council data varies | Unknown |
| Demographics, employment | ABS Data API, Census | Network access (key optional) | Unknown |
| Stamp duty | State revenue offices | Network access (loader ready) | User-entered duty |
| AI analyst narration | Claude API | `ANTHROPIC_API_KEY` (server-only) | Template analyst |
| Matterport | Showcase embed | — (SDK key only for advanced use) | — |

Every external host must also be allowed in this environment's network settings before I can build
or test the adapter.

## 4. Example properties

The 17 addresses in the brief are real properties. Proposal:

- **Not in the public DEMO seed.** Load them as **private manual properties for your own account**
  (or the dev investor account) from a fixture file, with only what you've told us: address and
  asset class, marked "Reported by you, unverified". Every other fact stays Unknown until a real
  source is attached. No preloaded scores, valuations or zoning.
- **The three required distinctions are tested with synthetic fixtures** whose facts carry explicit
  statuses: a buildable residential lot (verified dwelling entitlement) vs rural land with no
  confirmed entitlement; a mixed-use property vs a house; a flood-affected redevelopment site vs an
  unrestricted one. The engines must produce different feasibility, risk and checklist results.
  When real facts for the 17 addresses are retrieved from official sources, the same logic applies.

## 5. Stages

| Stage | Scope | Schema | Needs from you |
| --- | --- | --- | --- |
| **2a (first, smallest safe step)** | Quick Compare: price per m², land/building area, risk and development lines, confidence badges, expandable "why", leader only with sufficient evidence; add/remove/replace properties inside Compare; bottom-nav and sticky-bar overlap check on every compare/saved page; print-friendly report | none | Approval |
| 2b | Advanced Compare regrouped into sections A–G; 5/10/15-year side by side | none | — |
| 3a | `property_facts` + `asset_class` + `property_records.source = 'user'`; fact-pack builder; provenance badges everywhere | yes | Schema approval |
| 3b | Finance v2 (LVR, selling costs, net proceeds, cash-on-cash, annualised return, renovation, refinance) + exit strategies with feasibility status | none | — |
| 3c | `score-2.0.0`: 7 components, strategy presets, auto-normalised sliders, explicit risk gate; old saved comparisons keep `score-1.0.0` | none | — |
| 3d | Asset-class checklists, due-diligence list, synthetic distinction fixtures and tests | none | — |
| 4a | Template analyst: the §5 report sections generated from facts and engine outputs | none | — |
| 4b | LLM narrator (Claude), structured output, every number and claim validated against the fact pack | none | `ANTHROPIC_API_KEY` |
| 5 | Manual add by address / listing URL (link only), private example properties, workspace notes / checklist / comparison history, adapters for whichever providers are approved, price tracking | yes | Provider choices, keys, network access |
| 6 | Security and RLS tests for new tables, performance, error states, accessibility, PDF export | — | — |

## 6. Decisions needed

1. Approve stage 2a to start now (no schema).
2. Approve the fact-store schema (3a).
3. Example addresses: private manual properties for your account (recommended), not public demo data.
4. Score v2 replacing v1 for new comparisons (versioned).
5. AI analyst: template analyst first; Claude API narrator when you supply a key.
6. Which data providers to pursue first (planning/hazard open data is the cheapest start).
7. PDF: print-friendly report first; server-generated PDF later.

## 7. Suburb profiles (added 2026-10-31)

Requested after reviewing a portal's "Explore suburbs" screen: suburb-level demand and growth
figures (12-month and multi-year) are core to investing, so SitePilot gets its own suburb profile.
We don't copy any portal's figures (they're licensed, e.g. PropTrack); we compute ours from data
we're allowed to use, and show the source, period, sample size and status on every number.

### What the profile shows (per suburb, houses and units separately)

| Section | Figures | Source we can use | Status |
| --- | --- | --- | --- |
| Median price snapshot | Median sale price (rolling 12 months), by bedrooms where the sample allows | NSW Valuer General bulk property sales (official, free, weekly); VIC Valuer-General median prices; licensed providers elsewhere | Calculated from official records |
| Growth | Past 12-month change; 1, 3, 5 and 10-year annualised; 5-year median trend chart | Same sales records | Calculated, with sample sizes |
| Rent | Median weekly rent and gross yield (median rent × 52 ÷ median price) | NSW Rent and Sales Report (quarterly, by postcode); VIC DFFH rental report | Reported by government |
| Demand and supply | Sales in the last 12 months (official); listings available, days on market, buyer interest | Sales: official records. Listings, days on market, interest: only from a listings partner (Domain API, PropTrack) | Official / Not available until a partner is connected |
| Market summary | Plain-English paragraph generated from the numbers above (never invented) | Engine | Calculated |
| Local area | Suburb boundary map, schools, surrounding suburbs | ABS boundaries, NSW school locations (open data); map tiles from a provider allowed by our security policy | Official |

### Honesty rules that set SitePilot apart

- **Sample size is shown, not used to hide figures** (decision 2026-10-31). Every median and
  growth figure is calculated from the actual change and always shown, with a transparent "based on
  N sales" note beside it. Compare's analysis calls out small samples (e.g. "28.4% unit growth rests
  on 4 sales") when it explains rankings and scenarios.
- **Every figure carries** its period, sample size, source and retrieval date, and labels growth
  as **historical**, never a forecast.
- **Bedroom breakdowns** show each group's median with its own sales count; groups with no sales say "Unavailable".

### How it plugs into the rest of SitePilot

- Discover cards and listing pages: a suburb snapshot line (median, 12-month change, yield) with
  a link to the profile.
- Compare → Capital Growth (section B) and the Investment Match Score's market component use these
  figures, and the explanation states the number of sales behind each one.
- Area search and Search Any Address link to the profile.

### Build steps

1. **Engine and schema** (approval needed): `suburb_sales_stats` (suburb, state, postcode, property
   type, bedrooms, period, median, count, source, retrieved_at, status, is_demo) and
   `suburb_rent_stats`; pure, tested functions for rolling medians, growth, CAGR, yield and sample-size
   notes; DEMO suburb statistics for the demo towns, clearly labelled, to build the UI.
2. **Profile page** `/suburbs/[state]/[suburb]` in the style of the reference: snapshot, growth,
   trend chart, insight tiles, bedroom table, market summary, local area; mobile-first.
3. **Integration** into Discover, listing pages and Compare.
4. **Real NSW data**: a loader for NSW Valuer General sales files and the NSW Rent and Sales
   Report (needs those websites allowed in the network settings; licence terms checked).
5. **Other states and demand metrics** as providers are agreed.
