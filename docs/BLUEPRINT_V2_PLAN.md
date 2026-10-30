# Master Blueprint v2.0: gap analysis, roadmap and technical limitations

Source: *SitePilot AI — Master Blueprint v2.0 (30 Oct 2026)*, an **addendum** consolidating v1.0
and Update Pack 1.1 (`docs/SitePilot_AI_Master_Blueprint_v2.docx`). Nothing here removes working
functionality. All schema work is additive migrations; breaking changes are listed for approval.

Status: **approved 2026-10-30** with the changes recorded in section 10. V2-1 ✅ (0.4.0) · V2-2 ✅ (0.5.0) · V2-3 ✅ (0.6.0) · V2-4 next.

Priorities (from the request): **1. Dashboard · 2. Nationwide discovery · 3. Homeowner features
(My Property) · 4. SitePilot Vision**, with **Matterport optional and separate**.

---

## 1. Gap analysis

### Already built (preserved)

| v2.0 section | What exists |
| --- | --- |
| §2 Dashboard first, hero, two entry cards, bottom nav, guest browsing, separate professional workspace | Phase B (0.3.0): `/` dashboard, entry cards, quick actions, bottom tabs, guest access, `/firm` |
| §7 Deterministic, tested calculator with sensitivity and comparison; editable inputs; assumptions shown | Sprint 2: `src/lib/finance`, formula `feasibility-1.0.0`, tornado and heatmap, compare, append-only history |
| §7 Source, as-of date and verification status on facts | Evidence register (retrieval date, status, verifier), report sections 1–4 |
| §8 Investor and conveyancer dashboards, firm permissions, matters, tasks, audit logs | Sprints 0–1: RLS-enforced matters, grants, tasks, audit trail, session revocation |
| §9 Supabase RLS, private storage, upload validation (PDF ≤ 25 MiB), access logs, demo labels | 71 RLS tests; private bucket; `is_demo` never verifiable; report export auditing |
| §10 Soft blue/green, warm white, rounded cards, large tap targets | Phase B design tokens; 44px targets checked on iPhone size |
| §11 Next.js, TS, Tailwind, Supabase, GitHub CI, feature flags, migrations | As built |

### Needs updating

| Area | Today | v2.0 change |
| --- | --- | --- |
| Dashboard quick actions | Search address, Analyse, Saved, Alerts, Find a pro | Add **My Property** and **SitePilot Vision**; rename **Search Any Address** |
| Jurisdiction | NSW only: DB check, NSW postcode validation, Sydney dates, NSW copy | **All states and territories** for workspaces and discovery; state-aware postcode validation; per-property time zone for dates. Find a Pro is nationwide too, with per-state licence verification |
| Evidence source types | Labelled for NSW ("NSW Planning Portal record") | Generic labels with the state shown ("State planning portal") |
| Stamp duty | Investor enters an amount; not calculated | §7 wants "duty assumptions by state": optional **state presets as editable assumptions** with source and as-of date (see decision 3) |
| Off-market label | Plan said "Not listed for sale" | Use **NOT FOR SALE**, per v2.0 §3 |
| Content security policy | No external frames or images | Allow `my.matterport.com` frames only when the Matterport flag is on |
| Phase plan (v1.1 B–F) | C: discovery, D: saved and couples, E: signals, F: handoff | Re-sequenced below to put My Property and Vision before Couples polish and professional handoff |

### Missing (new)

| Feature | v2.0 § |
| --- | --- |
| Nationwide synthetic property and listing fixtures | §12 |
| Discover: two swipe decks, For Sale / Off-Market (NOT FOR SALE), Save/Pass buttons, demo labels | §3 |
| Saved properties, swipe events, Couples Mode mutual matches | §3, §11 |
| Search any Australian address → private workspace | §4 |
| **My Property**: owner dashboard, value history (only where licensed), maintenance and renovation ideas, saved AI concepts, notes | §4 |
| **Homeowner claims**: pending until verified, privacy-preserving; opt-out; revocable buyer enquiries | §4 |
| **SitePilot Vision**: photo upload, three modes, presets, prompts, before/after slider, versions, AI CONCEPT watermark, private by default, opt-in sharing, cost limits, consent | §5 |
| **Matterport** tours embedded in workspaces (optional) | §6 |
| Privacy-respecting analytics, waitlist, onboarding polish, limited beta | §12 |
| Still outstanding from v1.0: document vault and AI contract extraction (Sprint 3), invitations/matters/tasks UI (Sprint 4), billing sandbox (Sprint 5) | §8, §13 |

### Conflicts and proposed resolutions

1. **"Nationwide" vs NSW-only constraints.** Widen the jurisdiction check to all eight
   states/territories (additive), keeping NSW as the default. Professionals are listed per state
   only after their licence for that state is verified (§8, §9).
2. **"Platform admins have no access to client data" vs claim verification.** Add a narrow
   **claim verifier** role that can see *only* claim evidence, with every view audited and evidence
   deleted after a decision. It's not a general admin bypass.
3. **"Large photography" vs no licensed images (§9).** Keep illustrations for DEMO listings.
   User-uploaded photos appear only in that user's private workspace and Vision projects.
4. **Data separation (§9).** Today `properties` is a private workspace. Rather than overload it,
   add a separate `property_records` table (canonical address) and `homeowner_claims`; listings and
   claims reference records, and workspaces optionally link to a record or listing. No existing
   column changes meaning.
5. **Blueprint entity names vs existing tables.** Map, don't rename: `memberships` = firm
   memberships, `scenarios` = feasibility scenarios, `evidence` = evidence, `matters` = matters.
   New tables use the blueprint names (`saved_properties`, `swipe_events`, `couples_groups`,
   `homeowner_claims`, `buyer_enquiries`, `visual_projects`, `visual_versions`, `tours_3d`).
6. **"Taxes" in the calculator (§7) vs "no tax determinations".** Keep pre-tax results; add
   *tax placeholder* assumptions (land tax as a holding cost, GST/CGT "not modelled"). No computed
   tax figures.
7. **Buyer expressions of interest on off-market homes.** These could touch state agency
   licensing, the Spam Act and privacy rules. Decision: enabled, with the owner opt-in,
   revocation and platform-mediated contact safeguards in section 10.

## 2. Technical limitations (please read)

| # | Limitation | Consequence | What I'll do |
| --- | --- | --- | --- |
| L1 | **No licensed data access.** We have no listing, address, parcel, imagery, valuation or planning data contract. | "Nationwide" means nationwide *capability* with synthetic data, not real coverage (§1 says the same) | Nationwide **synthetic** fixtures labelled DEMO; manual address entry; a licensing-research doc. No scraping, no invented feeds |
| L2 | **Address autocomplete needs a provider.** G-NAF (Geoscape, open licence) is the national address file, but it's about 15M rows and several GB, and its EULA must be checked. Commercial APIs have storage limits | Search-any-address is manual entry plus a demo address index until a provider is chosen | Provider-agnostic `AddressSearch` interface with a demo implementation |
| L3 | **Claude can't generate or edit images.** Anthropic models read images but don't produce them. | SitePilot Vision needs a third-party image-editing model (candidates to evaluate: OpenAI image editing, Google Gemini/Imagen, Stability, Black Forest Labs via a host). It needs an account, an API key, a cost budget and a data-processing review (Australian privacy, overseas disclosure) | Provider-agnostic `VisionProvider`; a **mock provider** (deterministic, offline) for development and tests; real provider only after you choose one and supply a key |
| L4 | **AI renders aren't accurate.** Generated images can't be dimensionally correct and may hallucinate. | Must never imply boundaries, setbacks, compliance or approval | Burned-in **AI CONCEPT** watermark, persistent disclaimer, no measurements, "check with council and a licensed professional" |
| L5 | **Photo privacy.** Phone photos carry GPS EXIF data and can include people or neighbouring properties. | Leaking location or third-party images | Strip EXIF server-side, consent checkbox (rights + people), private storage, signed URLs, opt-in sharing only of watermarked output |
| L6 | **Aerial and street imagery licences** (Nearmap, Google and others) often forbid derivative works or storage. | Bird's-eye mode can't use third-party imagery yet | Bird's-eye mode works from **user-supplied** drone or aerial photos only, until a licence allows it |
| L7 | **AI cost and abuse.** Each generation costs money and may be abused. | Runaway spend | Per-user daily and monthly limits, a global budget cap, rate limits, a per-generation cost log (§13) |
| L8 | **Matterport.** Public or unlisted Showcase links embed via iframe; private tours, screenshots and anything programmatic need the **Showcase SDK key / Model API** (a Matterport subscription and terms). Mesh extraction or editing isn't supported or licensed. | v1 is embed-only, from a URL the user attests they're authorised to share | Validate the model ID, embed `my.matterport.com/show/?m=…`, CSP `frame-src` allow-list, `allow="xr-spatial-tracking"`; SDK research is a separate later task |
| L9 | **Ownership verification.** There's no free, privacy-preserving Australian ownership API. Title searches cost money per state via info brokers. | Claims can't be auto-verified | Claims stay **pending** until a verifier reviews evidence (e.g. a rates notice) or an approved provider is integrated. Never inferred from data |
| L10 | **Valuation history** needs a licensed AVM (e.g. Cotality/CoreLogic, PropTrack). | No value history at launch | The section is hidden or shows "Not available: no licensed data" (§4 "where licensed") |
| L11 | **Duty presets by state** need eight rate tables, kept current and sourced. | Wrong presets would mislead | Presets are labelled assumptions with source URL and as-of date, reviewed before release; manual entry remains |
| L12 | **Local environment.** Docker image pulls are rate-limited here, so I run Supabase Auth and PostgREST from source. Storage isn't running locally. | Vision and claim uploads can only be fully end-to-end tested once the Supabase Storage service runs (cloud project or Docker) | Storage access layer with RLS tests; e2e on a staging Supabase project when available |
| L13 | **Time zones.** Dates assume Sydney. | Wrong "today" in WA, SA, NT, QLD (no DST) | Per-property time zone derived from state |
| L14 | **60–90 day plan** depends on provider contracts and legal review (§12 says so). | Dates slip if access is slow | Every increment ships with synthetic data and mocks so it isn't blocked |

## 3. Revised sitemap

```
/                         Dashboard (guest + user)                         UPDATE: + My Property, Vision tiles
/discover                 Choose Home or Investment
/discover/home            Swipe deck · For Sale | Off-Market (NOT FOR SALE)  NEW
/discover/investment      Swipe deck · For Sale | Off-Market (NOT FOR SALE)  NEW
/listings/[id]            Listing detail (home / investment view)           NEW
/saved                    Saved · Home | Investment | Couples                NEW
/couples                  Couples Mode: invite, mutual matches               NEW
/search                   Search Any Address (demo index + manual entry)     NEW (guest can search; saving needs account)
/my-property              My Property: owned homes                           NEW
/my-property/[id]         Owner workspace: overview, ideas, notes, concepts,
                          value history (if licensed), claim, enquiries,
                          3D tour (optional)                                 NEW
/my-property/[id]/claim   Claim ownership (pending → verified/rejected)      NEW
/vision                   SitePilot Vision: projects                         NEW
/vision/new               Upload photo + consent → choose mode               NEW
/vision/[id]              Editor: presets, prompt, before/after slider,
                          versions, share (watermarked)                      NEW
/analyse                  Start a workspace (existing)                       EXISTING
/investor/...             Projects: workspaces, evidence, scenarios, report  EXISTING (+ 3D tour panel)
/settings                 Profile                                            EXISTING (+ privacy, data deletion)
/firm/...                 Professional workspace                             EXISTING
/verify (verifier role)   Claim review queue                                 NEW (restricted)
/alerts, /pros            Placeholders                                       EXISTING
```

Bottom nav stays Home / Discover / Analyse / Projects / Profile (§2). My Property and Vision are
reached from the dashboard and from Projects.

## 4. Wireframes (mobile-first, 390px)

```
DASHBOARD                         DISCOVER · HOME                  DISCOVER · INVESTMENT
┌───────────────────────┐         ┌───────────────────────┐        ┌───────────────────────┐
│ ◉ SitePilot AI  [Acct]│         │ [For Sale|Off-Market] │        │ [For Sale|Off-Market] │
│ Find your place.      │         │ ┌───────────────────┐ │        │ ┌───────────────────┐ │
│ Discover its potential│         │ │ illustration  DEMO│ │        │ │ $780k   DEMO      │ │
│ ┌────────┐┌─────────┐ │         │ │ $1.2m · Bondi NSW │ │        │ │ Gross yield 4.1%* │ │
│ │Find My ││Find My  │ │         │ │ 3 bd · 2 ba · 1 car││        │ │ Cash flow −$90/wk*│ │
│ │Home    ││Investmnt│ │         │ │ ♥ beach · cafes   │ │        │ │ Idea: granny flat │ │
│ └────────┘└─────────┘ │         │ └───────────────────┘ │        │ │ ⚠ flood overlay?  │ │
│ [Search any address]  │         │   (✕ Pass) (♥ Save)   │        │ │ *assumptions ▸    │ │
│ [My Property][Vision] │         │ Couples: 2 matches ▸  │        │ └───────────────────┘ │
│ [Analyse][Saved][…]   │         └───────────────────────┘        │ (✕ Pass)(♥ Save)      │
│ Your projects …       │         Off-market card: "NOT FOR SALE · │ [Analyse this deal ▸] │
├───────────────────────┤         speculative · suburb only"       └───────────────────────┘
│ Home Disc Anal Proj Me│
└───────────────────────┘

MY PROPERTY                       VISION EDITOR                    3D TOUR (optional)
┌───────────────────────┐         ┌───────────────────────┐        ┌───────────────────────┐
│ 12 Demo St, Ballarat  │         │ ◀ before ║ after ▶    │        │ Matterport tour       │
│ Claim: ⏳ Pending      │         │ [ slider over photo ] │        │ ┌───────────────────┐ │
│ Value history:        │         │  AI CONCEPT watermark │        │ │  <iframe embed>   │ │
│  "Not available"      │         │ Mode: Exterior        │        │ └───────────────────┘ │
│ Ideas: repaint, deck… │         │ Presets: Coastal ·    │        │ Added by you · you    │
│ Concepts (3) ▸        │         │  Modern · Heritage    │        │ confirmed you may     │
│ Notes ▸               │         │ Prompt [_________]    │        │ share it · Remove     │
│ Buyer interest: Off   │         │ (Generate · 3 left)   │        │ Not editable; scan    │
│ 3D tour ▸ (optional)  │         │ Versions v1 v2 v3     │        │ unchanged             │
└───────────────────────┘         └───────────────────────┘        └───────────────────────┘
```

## 5. Data model changes (additive migrations, each needing approval)

| Migration | Tables / changes | RLS summary |
| --- | --- | --- |
| M1 `nationwide` ✅ | `properties.jurisdiction` check → `NSW, VIC, QLD, WA, SA, TAS, ACT, NT`. Time zone is derived in code from state and postcode (no column needed) | Unchanged policies; new tests per state |
| M2 `property_records` ✅ | `property_records` (canonical address: state, suburb, postcode, street, `source`, `is_demo`, `gnaf_pid` nullable) ; `properties.property_record_id` nullable | Demo records readable by guests; others readable by authenticated users only once a licensed source exists |
| M3 `discovery` ✅ | `listings` (kind, market, NOT-FOR-SALE rules: no street address or price when off-market, provenance, `is_demo`), `swipe_events` (append-only), `saved_properties` (current state) | Guests read demo listings only; swipe and save rows are owner-only |
| M4 `couples` | `couples_groups`, `couples_members` (max 2), `couples_invites` (hashed token), `couples_shared` | Members see only explicitly shared items; private swipes never visible |
| M5 `my_property` | `owned_properties` (user ↔ record, nickname, notes), `property_notes`, `maintenance_items` | Owner-only |
| M6 `claims` | `homeowner_claims` (status pending/verified/rejected/withdrawn, method, evidence path, decided_by/at), `app.is_claim_verifier()`; `buyer_enquiries` (owner opt-in, revocable, platform-mediated messages) | Claimant sees own; verifier sees pending evidence only, every view audited; status changes via RPC only; never public |
| M7 `vision` | `visual_projects` (source photo path, mode, consent_at), `visual_versions` (prompt, preset, provider, model, cost_cents, output path, watermarked), `vision_usage` (per-user counters) | Owner-only; share tokens expose watermarked output only |
| M8 `tours_3d` | `tours_3d` (property or owned_property id, provider `matterport`, model_id, attested_by/at) | Same access as the parent workspace |
| M9 `duty_presets` (optional) | `duty_presets` (state, version, source_url, as_of, brackets jsonb, reviewed_by) | Read-only reference data |

Storage buckets: `vision-sources` and `vision-outputs` (private, image/jpeg/png/webp ≤ 15 MiB),
`claim-evidence` (private, short retention). Each migration ships with permitted and denied tests.

## 6. Provider and licensing dependencies

| Need | Candidates to investigate | Blocking? | Interim |
| --- | --- | --- | --- |
| Listings (for sale) | Domain API, REA (partnership), PropTrack, Cotality | Real listings: yes | Synthetic DEMO |
| Addresses | G-NAF (Geoscape open data), Geoscape APIs, state address services | Autocomplete: yes | Demo index + manual entry |
| Parcels / planning | State portals (NSW Planning Portal, VicPlan, QLD, …), council data, Geoscape | Planning facts: yes | Manual evidence register |
| Valuation history | Cotality/CoreLogic, PropTrack, Pricefinder | Value history: yes | "Not available" |
| Aerial / street imagery | Nearmap, state imagery programs; Google (restrictive terms) | Bird's-eye from imagery: yes | User-supplied photos |
| Image generation (Vision) | OpenAI, Google, Stability, BFL hosts: compare cost, quality, data terms, region | Real renders: yes | Mock provider |
| Ownership verification | Title search brokers (InfoTrack, LANDATA, etc.), postcard code, document review | Auto-verify: yes | Manual verifier review |
| Matterport | Showcase embed (public/unlisted); SDK key for advanced use | Embed: no · SDK: yes | Embed only |
| Analytics | Privacy-respecting (self-hosted Plausible, PostHog EU/AU) | No | Server-side event table |

## 7. Security risk register

| Risk | L | I | Mitigation |
| --- | --- | --- | --- |
| Cross-tenant access to photos, claims, saved lists | M | H | RLS on every table and bucket; permitted and denied tests; signed URLs ≤ 5 min |
| Owner identity or inferred ownership exposed | M | H | Claims private; off-market rows hold no street or owner data; no "owner of …" UI; consent-gated enquiries |
| Fraudulent ownership claim | M | H | Pending until manual verification; one active claim per record; audited verifier actions; revocation |
| GPS or personal data in uploaded photos | H | M | EXIF stripped server-side; consent; private by default |
| Generated content misread as approved plans | M | H | Burned-in watermark, disclaimers, no measurements or compliance language, share only watermarked output |
| Harmful or abusive generation prompts | M | M | Provider moderation, preset-first UX, prompt length limits, logged prompts, report button |
| AI cost blow-out | M | M | Per-user quotas, global cap, rate limiting, cost logging, kill switch flag |
| Malicious uploads | M | H | Type sniffing (magic bytes), size limits, image re-encoding, malware scan before processing |
| Third-party iframe risk (Matterport) | L | M | CSP `frame-src` allow-list only when flagged; `sandbox` attributes; no tokens passed |
| Licensing breach (images or listings) | M | H | Synthetic only; provenance column on every external record; licensing doc before integration |
| Misleading "nationwide" or "for sale" claims | M | H | DEMO labels, NOT FOR SALE label, coverage disclaimers |
| Verifier misuse | L | H | Least-privilege role, audit every read, evidence retention limit, separation from platform admin |

## 8. Feature flags

Existing: `discovery`, `couples`, `alerts`, `findAPro`.
New: `nationwide`, `myProperty`, `homeownerClaims`, `buyerEnquiries` (on; owner opt-in, revocable),
`vision`, `visionRealProvider` (off: mock provider), `matterport`, `dutyPresets`.

## 9. Roadmap (re-sequenced to the requested priorities)

Each increment: migrations with RLS tests, unit tests, browser tests (desktop and iPhone),
screenshots, a changed-file summary, then a review stop.

| Inc. | Days* | Scope | Schema | Needs from you |
| --- | --- | --- | --- | --- |
| **V2-1 Dashboard v2 + nationwide foundation** | 1–7 | Dashboard tiles (My Property, Vision, Search Any Address); all states/territories for workspaces; state-aware postcode validation; per-property time zones; generic evidence labels | M1 | Approval |
| **V2-2 Nationwide demo Discover** | 8–20 | `property_records` + `listings` with ~40 synthetic DEMO listings across all states (illustrated); both swipe decks; For Sale / NOT FOR SALE tabs; Save/Pass and keyboard; guest local saves; `swipe_events` and `saved_properties`; `/saved` | M2, M3 | — |
| **V2-3 Search Any Address + My Property** | 21–32 | `/search` (demo index + manual); My Property dashboard; notes; maintenance and renovation ideas (curated static guidance, no AI figures); value history placeholder; claim **pending** flow + verifier queue | M5, M6 (claims only) | Claim evidence policy |
| **V2-4 SitePilot Vision (photo-based)** | 33–45 | Upload with consent and EXIF strip; modes and presets; mock provider; before/after slider; versions; watermark; quotas; private storage; opt-in share | M7 | Image provider choice + key to go live |
| **V2-5 Matterport (optional)** | 46–50 | Embed tours in workspaces and My Property; attestation; CSP allow-list; flag | M8 | — |
| **V2-6 Couples Mode + investor signals** | 51–60 | Couples groups and mutual matches; indicative yield and cash flow with provenance; "Analyse this deal"; starter scenario cards; optional duty presets | M4 (+M9) | Approve duty presets |
| **V2-7 Professional workflows** | 61–75 | v1.0 Sprint 3 (document vault, extraction with evidence links, MFA for professionals) and Sprint 4 (invitations, matters, tasks UI) | Sprint 3/4 | AI extraction provider key |
| **V2-8 Beta readiness** | 76–90 | Security testing, onboarding, privacy analytics, waitlist, Stripe sandbox, licensing reports, legal review checklist | Sprint 5 | Legal and provider contracts |

\*Target days from approval, per §12; contingent on provider access and reviews.

## 10. Decisions (approved 2026-10-30)

1. **Nationwide:** workspaces, discovery **and Find a Pro** cover all states and territories.
   Professionals record the states they're licensed in and the licence type (licensed conveyancer
   or solicitor; Queensland conveyancing is done by solicitors). Each state is verified manually
   against that state's public register before the firm appears there.
2. **Data separation:** new `property_records` and `homeowner_claims` tables, as proposed.
3. **Duty presets by state:** approved (V2-6) as reviewed, sourced, editable assumptions.
4. **Claim verification:** manual review of evidence by a restricted, audited verifier role.
5. **Buyer enquiries: enabled** (flag on), not held for legal review. A lawyer or conveyancer
   engages once a buyer is serious and title work begins. Safeguards stay built in: the owner
   opts in, can opt out or revoke at any time, and messages are mediated by the platform, so
   neither party's contact details are shared until the owner chooses. Rate limits and reporting
   apply. Off-market homes are never presented as for sale.
6. **Vision:** mock provider now; provider comparison prepared before choosing.
7. **Matterport:** embed-only now; SDK research later.
8. **Sequence:** V2-1 → V2-8 as above.
