# SitePilot Agents: plan

Status: **proposed 2026-11-04, awaiting approval.** Turns the "agentic workflow" idea (find the
property → work out what can be built → handle the transaction) into three agents that fit
SitePilot's rules: official sources only, nothing invented, every finding cited and checked by a
person, and no legal or financial act done by software.

Build order: **A0 shared foundation → A1 Planning check (NSW) → A2 Find for me → A3 Contract prep.**

## 1. The three agents in one picture

```
"Under $900k, room for a granny flat, near Newcastle"
        │
  A2 Find for me ──► shortlist (SitePilot listings + addresses the user gives it)
        │                 │
        │                 ▼
        │        A1 Planning check (per property)
        │          official controls (fixed code) + council rules (AI reads, cites)
        │                 │
        ▼                 ▼
     Compare ranks them for the user's goal (existing, 0.15.0)
        │
        ▼  user chooses one and gets the contract
  A3 Contract prep ──► draft findings + deadlines + questions ──► user's conveyancer (existing matters)
```

| Agent | User-facing name | What it does | What it never does |
| --- | --- | --- | --- |
| A1 | **Planning check** | Pulls the official planning controls for a NSW lot, calculates the indicative buildable size, reads the council's development control plan and the state codes for the rules the maps don't hold, and saves each result as an unverified, cited finding | Say something is "legally allowed" or "approved"; give planning advice in place of a town planner |
| A2 | **Find for me** | Turns a plain-English brief into filters and a goal, searches SitePilot's listings and any addresses the user supplies, runs A1 on the top few, and opens Compare | Scrape or search realestate.com.au, Domain or any other listing site |
| A3 | **Contract prep** | Reads the uploaded contract and certificates, flags issues with page references, builds the deadline list (e.g. NSW cooling-off) and draft questions, and hands the pack to the user's conveyancer | Sign, pay, exchange, lodge, settle (PEXA), apply for a loan, or send anything without the user's approval |

## 2. Rules that apply to every agent

1. **Facts from fixed code, judgement from the AI.** Anything a published source states directly
   (zone, height limit, floor space ratio, lot area, minimum lot size, heritage, hazards) is fetched
   and calculated by tested code. The AI is used only to read documents and apply rules written in prose,
   and must cite the clause and page for each conclusion.
2. **Everything an agent produces is a draft.** Results go into the existing `evidence` and `findings`
   tables as `unverified`/`unreviewed`, with source URL, retrieval date and AI model. Only a person
   (the user, a town planner or a conveyancer) can mark them verified. The Development rating in
   Compare keeps counting verified evidence only.
3. **Documents are data, never instructions.** Contracts, council PDFs and listing text are passed
   to the model as documents. Instructions inside them are ignored, and tools reachable from a run
   that reads them can only read, or write drafts.
4. **No outward action without a human.** Read-only tools run freely. Any tool that would send an
   email or message, share with a firm or create a task outside the user's own workspace needs the
   user to approve that exact action first. Payment, signing and lodging tools don't exist.
5. **Allowlisted sources only.** Agents fetch only from a list of official hosts (section 6). Sites
   that block automated access are not worked around; the user is asked to upload the document instead.
6. **Every step is recorded.** Each run stores its steps, tool calls, sources, tokens and cost, and
   writes `audit_events`. A run can be replayed to show the user exactly how a result was reached.
7. **Hard cost caps.** Per-run token budget, a per-user monthly allowance by plan tier, and an
   organisation-wide monthly cap. A run that hits a cap stops cleanly and says what it got through.
8. **Plain language and honest gaps.** Results use the plain-language style from Compare (0.15.0):
   "the controls indicate…", "not enough information", "ask a town planner to confirm".

## 3. A0: shared foundation (build first, about 1 stage)

**Tables (new migration):**
- `agent_runs`: id, org, user, property (optional), agent (`planning_check` / `find_for_me` /
  `contract_prep`), status (queued / running / needs_approval / done / failed / stopped_at_cap),
  input brief, summary, model, tokens in/out, cost in cents, started/finished. RLS: the owning
  workspace only.
- `agent_steps`: run, sequence, kind (tool_call / tool_result / model_note / approval_request /
  approval_decision), tool name, input and output (truncated and redacted), source URL, timestamp.
- `agent_approvals`: run, step, the exact action proposed, approved by, decided at, decision.
- `planning_rule_cache`: council, instrument (LEP/DCP/SEPP), clause, extracted rule, source URL,
  retrieved at, status. Rules read once for a council are reused for the next lot (cheaper, and
  consistent), and refreshed when the source changes.

**Runtime:**
- Claude API through the official TypeScript SDK (`@anthropic-ai/sdk`), server-only, in
  `src/lib/agents/`. Tool runner with schema-checked tools (`betaZodTool`, `strict: true`).
- Default model: the current Opus (`claude-opus-5-5`) with adaptive thinking; effort set per agent
  (high for Planning check and Contract prep, low for the brief-to-filters step of Find for me).
  Server-side refusal fallback turned on.
- Documents sent as PDF/text document blocks with **citations enabled**, so every AI conclusion
  carries the exact quoted text and page. These feed `findings.extracted_text`, `page_ref` and spans.
- Prompt caching on the fixed system prompt, tool list and shared council documents; task budgets
  per run so the agent paces itself inside the cap.
- Runs are background jobs (queued in `agent_runs`, picked up by a server worker), with progress
  shown in the UI by polling. Nothing long runs inside a page request.
- Feature flag `NEXT_PUBLIC_FLAG_AGENTS` (off by default) and one flag per agent. Without an API
  key, a deterministic mock runs (as Vision does) so tests and the demo work offline.

**Quality:**
- An evaluation set: about 30 NSW lots (varied councils and zones) with answers confirmed by a town
  planner, and about 10 sample contracts with a conveyancer's issue list. Every prompt or model change is
  measured against it before release.
- Unit tests for all fixed-code tools, RLS tests for the new tables, browser tests with the mock.

## 4. A1: Planning check, NSW first

**Confirmed reachable today (2026-11-04):** the NSW Planning Portal ePlanning API. Address search
returns the lot; one "layer intersect" call returns, for example, for 1 Smith Street Wollongong:
Wollongong LEP 2009, zone R1 General Residential, height 24 m, FSR 1.5:1, minimum lot size 449 m²,
heritage (local monument), acid sulfate soils class 5, plus the lot boundary. The state hazard map
services (flood and others) also answer. The NSW legislation website does not (it blocks automated
access), so LEP clause text comes from the Planning Portal or a user upload.

**Steps (one run per property):**
1. **Find the lot** (fixed code): address → property ID → lot and plan, boundary.
2. **Official controls** (fixed code): zone, height, FSR, minimum lot size, heritage, hazards and
   other mapped layers, each stored as `evidence` with source `planning_portal` and status unverified.
3. **Site measurements** (fixed code): lot area from the boundary (projected properly, not in map
   units), approximate frontage and depth, all labelled "estimated from the lot boundary".
4. **Indicative envelope** (fixed code): maximum floor area = lot area × FSR where an FSR is mapped;
   storeys from the height limit; subdivision check against the minimum lot size. Each figure shows its
   formula and inputs (added to FORMULAS.md), and says "not mapped" where there's no control.
5. **Rules the maps don't hold** (AI, cited): the council's development control plan (setbacks, site
   coverage, landscaping, parking, secondary dwelling rules) and the state complying-development
   and housing codes for common projects (granny flat, dual occupancy, extension, pool). It reads
   official documents only, cites clause and page, and stores each rule in `planning_rule_cache`.
6. **What could fit** (AI over the facts above): a short list of options ("granny flat: likely
   possible as complying development if…", "dual occupancy: permitted in R1, check DCP clause…"),
   each with its conditions, citations and confidence, and the three things most likely to stop it.
7. **Result page**: a plain-language summary, the controls table with sources, the envelope, the
   options with "Ask a town planner to confirm" and "Order a planning certificate (section 10.7) from
   council", and buttons to verify or dispute each item. Feeds the Development rating once verified.

**Not in A1:** approvals, heritage impact or flood engineering advice, other states. Next states in
order of data access: VIC (VicPlan), QLD (council schemes, one at a time).

## 5. A2: Find for me

1. **Brief to search** (AI, low effort): turns plain English into the existing filters (area, price,
   type, beds, land size, yield) and a Compare goal, shown back to the user to edit before searching.
2. **Search** (fixed code): SitePilot's own listings (DEMO today), the user's saved properties, and
   addresses the user pastes or types. A listing URL can be saved as a link only, without fetching
   the page. Real for-sale listings need a licensed feed (e.g. Domain API); until one is signed, the
   agent says so.
3. **Check** (A1 on the top 3–5, within the user's allowance) and **rank** with Compare's goal
   ratings, then open Compare with the shortlist and the verdict.

## 6. A3: Contract prep

Needs the documents vault first (upload, virus scan, private storage, retention). That vault was
planned for v1.0 Sprint 3 and isn't built yet, so it's part of this stage.

1. **Read** (AI, cited): contract for sale, section 10.7 certificate, title search, strata report,
   building report. Each issue becomes a `finding` with category, quoted text, page and confidence:
   special conditions, easements and covenants, zoning differences from A1, missing documents,
   unusual settlement terms, deposit terms.
2. **Deadlines** (fixed code from extracted dates): cooling-off end (NSW: 5 business days, skipping
   weekends and public holidays), finance and building-inspection dates, settlement date. Shown as a checklist,
   with reminders the user can turn on.
3. **Questions** (AI): draft questions for the selling agent and for the conveyancer, for the user to
   edit and send themselves.
4. **Hand-off** (needs approval): share the documents, findings and questions with the user's
   conveyancer through the existing matters feature; the conveyancer confirms or rejects each
   finding in their review queue (already built).

The software never exchanges, signs, pays, lodges or settles. Conveyancing stays with the licensed
conveyancer or solicitor, and loans with a licensed broker or lender.

## 7. Sources and access

| Source | Used by | Access | Status |
| --- | --- | --- | --- |
| NSW Planning Portal ePlanning API (address, lot, layer intersect) | A1 | Public | ✅ reachable, tested |
| NSW planning and hazard map services | A1 | Public | ✅ reachable |
| Council development control plans (council websites) | A1 | Public, per council | To check per council; upload if blocked |
| NSW legislation website (LEP clauses, SEPPs) | A1 | Public | ❌ blocks automated access; use the Planning Portal or upload |
| SitePilot listings and saved properties | A2 | Own data | ✅ |
| Licensed for-sale listings (e.g. Domain API) | A2 | Commercial agreement | Not signed |
| Contracts and certificates | A3 | Uploaded by the user | Needs the documents vault |
| Claude API | All | API key + billing | Needed |

## 8. Rough running costs (to be measured in A0)

Estimates at current Opus prices ($4 per million input tokens, $20 per million output), before caching:

| Run | Typical size | Estimated cost |
| --- | --- | --- |
| Planning check, council already in the rule cache | ~20k tokens | ~$0.10–0.20 |
| Planning check, new council (reads its DCP) | ~80–150k tokens | ~$0.50–1.00 |
| Find for me (brief + ranking, excluding planning checks) | ~10k tokens | ~$0.05 |
| Contract prep (60–100 page pack) | ~100–200k tokens | ~$0.80–2.00 |

Proposed caps: $2 per planning check, $4 per contract prep, monthly allowances by plan tier.

## 9. Decisions needed

1. **Approve the order** A0 → A1 (NSW) → A2 → A3, with the rules in section 2.
2. **API key and budget**: an Anthropic API key for the environment, an organisation-wide monthly cap,
   and the per-run caps above (or yours).
3. **Who checks the evaluation set**: a NSW town planner for about 30 lots before A1 goes live, and a
   conveyancer for about 10 contracts before A3. Without them, the agents ship as demo only.
4. **Plan tiers**: suggested Planning check on Investor Pro and Developer (with a monthly allowance),
   Find for me on all paid tiers, Contract prep on Investor Pro and above, plus the Conveyancer tier
   on the firm side.
5. **Listings feed for A2**: start with SitePilot listings and user addresses, and decide later on a
   licensed feed.
6. **Contract retention**: how long uploaded contracts and certificates are kept (suggest until the
   matter closes plus 12 months, deletable by the user any time).
