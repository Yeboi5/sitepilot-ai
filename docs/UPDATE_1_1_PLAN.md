# Update Pack 1.1: gap analysis and staged plan

Source: *SitePilot AI — Product & UI Update Pack, v1.1 (30 Oct 2026)*, an **addendum** to the
MVP blueprint. Everything built in Sprints 0–2 is preserved. Nothing below removes a feature; new
work is additive and behind feature flags where it changes what users see.

Status: **approved 2026-10-30.** Phase A ✅ · Phase B ✅ (0.3.0) · Phase C next.

---

## 1. Gap analysis

### Already built (keep as is)

| Addendum requirement | Where it lives today |
| --- | --- |
| Authentication, organisations, deny-by-default RLS, audit log, session revocation | `supabase/migrations/*`, 67 RLS tests |
| Canonical property workspace: overview, evidence (source links and retrieval dates), scenarios | `/investor/properties/[id]` |
| Deterministic, tested feasibility (not LLM-generated), with assumptions shown | `src/lib/finance/*`, `docs/FORMULAS.md` |
| Gross yield and cash flow after interest | Retain-and-rent strategy in the engine |
| Planning constraints only from authoritative, attributed evidence; no automated zoning claims | Evidence register, verification status, planning-checks notice |
| Demo data marked DEMO and never verifiable | `is_demo` flag, DB constraint, badges and banners |
| Separate role-based conveyancer dashboard | `/firm` (matter inbox), `/firm/matters/[id]`, `/firm/review` |
| Conveyancers can't access unrelated user data | Matter grants on active matters only (RLS-tested) |
| AI never issues legal conclusions; professional review | Findings model, report section 4, disclaimers (AI pipeline is Sprint 3) |
| Private documents, secure storage, no trust money | Private bucket and storage RLS; out of scope by design |

### Needs updating

| Area | Today | Change |
| --- | --- | --- |
| Entry point | `/` is a marketing page; signed-in users land on `/investor` | `/` becomes the **dashboard** for guests and users (hero, two entry cards, action tiles). Marketing copy moves to `/about` |
| Navigation | Desktop top bar only | Responsive shell: top bar on desktop, **bottom nav on mobile** (Home, Discover, Analyse, Projects, Profile). Conveyancers keep their own nav |
| Visual design | Neutral slate and blue, small type | Design tokens: soft blue and green accents, warm neutrals, rounder cards, larger type, larger tap targets, optional motion (respects reduced-motion) |
| Onboarding | Every account must create an organisation before using the app | Consumers get a **personal workspace created automatically**; firms still onboard explicitly. Same tenancy model and RLS |
| Guests | Must sign in for everything | Guests can browse the dashboard and **DEMO** listings; an account is needed to sync saves, alerts and private projects |
| Pricing page | Shows indicative prices (no paywall) | Remove from navigation until pricing is agreed (page kept, unlinked) |
| Investor dashboard (`/investor`) | Separate dashboard page | Becomes **Projects**; URLs unchanged |
| Settings | Organisation, members, plan, audit | Becomes **Profile**; adds discovery preferences and Couples Mode |
| Scenarios | Blank editor | Adds three **starter scenario cards** pre-filled from a listing's labelled assumptions, using the same engine |

### New

| Feature | Notes |
| --- | --- |
| Dashboard hero: "Find your place. Discover its potential." | Find My Home / Find My Investment cards; tiles for Search Address, Analyse a Property, Saved, Alerts, Find a Pro |
| Find My Home | Large cards (licensed photos only; DEMO uses illustrations), price, suburb, beds and baths, lifestyle filters |
| Find My Investment | Asking price, **indicative** gross yield and cash flow (deterministic, with provenance and assumptions), scenario hint, risk flags, "Analyse this deal" |
| For Sale / Off-Market Potential tabs | Off-market cards say **"Not listed for sale"**, explain they are speculative, and show suburb-level location only with no owner details |
| Swipe deck | Swipe right to save, left to pass, plus accessible Save/Pass buttons and keyboard shortcuts |
| Saved properties (shortlists) | Home and Investment tabs; each opens its canonical property workspace |
| Couples Mode | Linked partner accounts, separate preferences, **explicit** sharing, mutual-match list |
| Analyse | Search an address → create a property workspace (manual entry only; no live data) |
| Alerts, Find a Pro | Placeholder screens until notifications (original Sprint 4) and the legal review of referrals |
| Feature flags | `discovery`, `couples`, `alerts`, `findAPro` |

## 2. Conflicts and how they're resolved

1. **`/` marketing page vs "start at a dashboard".** The dashboard replaces it; the marketing
   content moves to `/about`. Disclaimers stay in the footer.
2. **Mandatory organisation onboarding vs consumer-first discovery.** A personal investor
   workspace is created on first sign-in, so tenancy and RLS stay unchanged. Firms still choose
   "conveyancing firm" in onboarding.
3. **"Anonymous gets nothing" (current RLS) vs guest browsing.** One deliberate exception: guests
   may *read* listing rows flagged DEMO. Every other table stays closed, with tests either way.
4. **Pricing page vs "no pricing until agreed".** It's unlinked from navigation and kept for later.
5. **Listing photos.** None until a licensed source exists. DEMO listings use generated
   illustrations; no scraping.
6. **Off-market privacy.** No street address, owner name or contact for off-market rows, enforced
   by schema (the columns aren't stored) and by UI copy.
7. **Order versus the original roadmap.** Original Sprints 3 (documents and AI), 4 (invitations,
   matters, tasks) and 5 (billing sandbox) are still to do. Phase F's "professional handoff" is
   original Sprint 4. Proposed order: Phases B–E, then Sprint 3, then Phase F with Sprint 4, then
   Sprint 5.

## 3. Updated sitemap

```
/                      Dashboard (guest + signed-in)            NEW (replaces marketing landing)
/about                 Marketing / how it works                 MOVED from /
/discover              Choose Home or Investment                NEW
/discover/home         Swipe deck · tabs: For Sale | Off-Market NEW
/discover/investment   Swipe deck · tabs: For Sale | Off-Market NEW
/listings/[id]         Listing detail (home or investment view) NEW
/saved                 Shortlists · Home | Investment | Couples  NEW
/couples               Invite partner, mutual matches           NEW (flag)
/analyse               Search address → new property workspace  NEW (wraps existing "add property")
/alerts, /pros         Placeholders                             NEW (flag)
/investor/...          Projects: workspaces, evidence,          EXISTING (nav label "Projects")
                       scenarios, compare, report
/settings              Profile: organisation, preferences,      EXISTING (+ preferences)
                       members, plan, audit
/firm/...              Conveyancer dashboard                    EXISTING (own navigation)
/sign-in, /sign-up, /onboarding, /pricing (unlinked)            EXISTING
```

Bottom nav (mobile, investor/consumer): **Home** `/` · **Discover** `/discover` · **Analyse**
`/analyse` · **Projects** `/investor/properties` · **Profile** `/settings`.

## 4. Component plan

| Component | Type | Purpose |
| --- | --- | --- |
| `AppShell` | server | Top bar (desktop), `BottomNav` (mobile), skip link, guest/user state |
| `BottomNav` | client | Five tabs, active state, 48px targets, safe-area inset |
| `DashboardHero` | server | Headline, two entry cards |
| `ActionTiles` | server | Secondary actions grid |
| `MarketTabs` | client | For Sale / Off-Market, ARIA tablist, URL `?market=` |
| `SwipeDeck` | client | Card stack: pointer drag, keyboard (←/→), Save/Pass buttons, undo, reduced-motion support; pure reducer unit-tested |
| `ListingCard` | server/client | `home` and `investment` variants; DEMO badge; "Not listed for sale" for off-market |
| `PropertyIllustration` | server | Deterministic SVG per listing (no photos) |
| `InvestmentSignals` | server | Yield and cash flow with an "Assumptions and source" disclosure |
| `OffMarketNotice` | server | Speculative and not-for-sale explanation |
| `FilterSheet` | client | Lifestyle and price filters (dialog on mobile) |
| `Shortlist` | server | Saved items, "Open workspace", share toggle |
| `CouplesPanel` | server/client | Invite, partner status, mutual matches |
| `StarterScenarioCards` | server | Three scenario cards built with the existing engine |

## 5. Database changes (additive migrations only)

| Migration | Contents |
| --- | --- |
| `…_listings` (Phase C) | `listings`: `kind` (`home`/`investment`), `market` (`for_sale`/`off_market`), `is_demo`, suburb, postcode, state, property type, beds, baths, cars, land m², asking price (**must be null when off-market**), price display, `street_address` (**must be null when off-market**), lifestyle tags, `indicative_weekly_rent` (labelled assumption), headline, description, `illustration_seed`, `provenance` jsonb (source, retrieved_at, licence). RLS: `anon` and `authenticated` may **select only `is_demo` rows** (later: licensed rows); no client writes. `listing_reactions` (`user_id`, `listing_id`, `save`/`pass`): owner-only |
| `…_couples` (Phase D) | `households`, `household_members` (max 2), `household_invites` (hashed token, expiry), `shared_listings` (`household_id`, `listing_id`, `shared_by`). A member sees only items explicitly shared into their household; private reactions stay private. Mutual match = shared by both members |
| `…_property_listing_link` (Phase D) | `properties.listing_id` (nullable FK) + unique (`owner_org_id`, `listing_id`), so one canonical workspace per listing per organisation |
| `…_preferences` (Phase D) | `user_preferences` (home and investment filters as validated jsonb), owner-only |
| `…_personal_workspace` (Phase B) | `ensure_personal_workspace()` RPC: idempotent personal investor organisation for consumers |

Every migration ships with permitted **and** denied RLS tests, regenerated types and
data-dictionary entries, following the SECURITY.md checklist.

## 6. Feature flags

`src/lib/flags.ts` reads `NEXT_PUBLIC_FLAG_*` env vars (default on in development and demo, off
in production until signed off): `discovery`, `couples`, `alerts`, `findAPro`. Flags hide
navigation and return 404 for flagged routes. Database security never depends on a flag.

## 7. Staged implementation plan

Each phase is a small, tested increment: unit, RLS and browser tests (including an **iPhone-size
390×844 project**), screenshots, then a review stop.

| Phase | Scope | Schema change | Acceptance (from the addendum) |
| --- | --- | --- | --- |
| **A** | This plan | None | Approved |
| **B** | Design tokens; `AppShell` + `BottomNav`; dashboard at `/` for guests and users; `/about`; personal workspace on first sign-in; pricing unlinked | `ensure_personal_workspace` RPC only | Guest can navigate the dashboard; works at 390px; existing tests still pass |
| **C** | `listings` + ~20 DEMO listings (NSW, illustrated); `/discover/home` and `/discover/investment` decks; For Sale / Off-Market tabs; guest swipes kept in the browser, user swipes saved to the account | `listings`, `listing_reactions` | Guest browses demo cards; Home and Investment look distinct but coherent; both have the toggles; swipes and buttons update the shortlist |
| **D** | `/saved` shortlists; "Open workspace" creates or links the canonical property; Couples Mode with explicit sharing and mutual matches; preferences | couples, property link, preferences | Saved properties open their workspace; Couples Mode shares only what each user explicitly chooses |
| **E** | Investment signals (pure, tested, with provenance); "Analyse this deal" pre-fills a workspace; three starter scenario cards | None | Investor metrics show provenance and assumptions |
| **F** | Privacy-respecting analytics; listing-data licensing investigation (document, no integration); professional handoff (original Sprint 4); user testing | Sprint 4 tables | Conveyancers still can't access unrelated user data (re-run the RLS suite) |
| then | Original Sprint 3 (documents and AI) and Sprint 5 (billing sandbox) | per blueprint | per blueprint |

## 8. Decisions needed before Phase B

1. Make the dashboard the home page `/` and move the marketing page to `/about`.
2. Auto-create a personal workspace for consumers instead of the onboarding step.
3. Allow guests to read **DEMO** listing rows (the only anonymous-readable data).
4. Unlink the pricing page until pricing is agreed.
5. No listing photos until licensed; DEMO uses illustrations.
6. Off-market: suburb-level only, never a street address or owner details.
7. Couples Mode: swipes private; partners see only what each explicitly shares; matches = shared by both.
8. Roadmap order: Phases B–E → Sprint 3 → Phase F with Sprint 4 → Sprint 5.
