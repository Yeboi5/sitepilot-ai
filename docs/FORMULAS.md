# Feasibility formulas: `feasibility-1.0.0`

Source of truth: `src/lib/finance/feasibility.ts` and `sensitivity.ts`, tested in
`feasibility.test.ts` against hand-calculated figures. **Bump `FORMULA_VERSION` whenever any
output for the same input would change**, and record the change here.

All inputs are the investor's **assumptions** (blueprint §8). SitePilot supplies no valuations,
construction rates, stamp duty, land tax or tax figures. All amounts are AUD, and results are
**pre-tax**: GST, CGT and income tax are **not modelled**, and nothing is a tax determination.

## Inputs

| Group | Inputs |
| --- | --- |
| Strategy | `develop_and_sell` or `retain_and_rent` |
| Land | basis (`purchase_price` or `current_value`), amount |
| Acquisition | stamp duty (investor's estimate), legal and other |
| Soft costs | design, consultants and approvals |
| Hard costs | demolition, site works, build cost, infrastructure contributions and services |
| Contingency | % of soft + hard costs |
| Timeline | project months (≥ 1), construction start month (0-based), construction months |
| Finance | interest rate % p.a., % of land funded by debt, % of construction funded by debt, finance fees |
| Holding | costs per month (rates, insurance, land tax estimate) |
| Sale (develop and sell) | assumed sale value, selling costs % |
| Rent (retain and rent) | assumed value on completion, current gross rent, projected gross rent, additional operating costs (all annual) |

Validation: money ≥ 0 and ≤ $1bn; contingency ≤ 50%; interest ≤ 30%; debt shares ≤ 100%;
selling costs ≤ 20%; whole months; construction must start before and finish within the project.

## Costs

```
land          = land.amount                     (price, or current value as opportunity cost)
acquisition   = stampDuty + legalAndOther
soft          = designAndApprovals
hard          = demolition + siteWorks + construction + infrastructure
contingency   = contingencyPct × (soft + hard)
holding       = monthlyHoldingCosts × projectMonths
selling       = sellingCostsPct × saleValue      (develop and sell only; 0 otherwise)
TDC           = land + acquisition + soft + hard + contingency + holding + financeFees + interest + selling
```

## Debt draw schedule and interest

- Hard costs plus their contingency are spread evenly across the construction months
  (all in the start month if construction has no duration).
- **Draws:** land debt (`landDebtPct × land`) in month 0, plus `constructionDebtPct` of each
  month's construction spend in that month.
- **Interest** accrues monthly at `rate / 12` on the drawn balance, including draws made that
  month, and is **capitalised** (added to the balance) for every month of the project.
- `peakDebt` = closing balance; `principalDrawn` = sum of draws.
- `equityRequired` = (land + acquisition + soft + hard + contingency + holding + financeFees) −
  principalDrawn. Interest is capitalised and selling costs are paid from proceeds.

## Develop and sell

```
realisation        = assumed sale value
margin             = realisation − TDC
ROI (return on cost) = margin / TDC                 (n/a if TDC = 0)
margin on realisation = margin / realisation       (n/a if realisation = 0)
```

Warning when `margin < 0`.

## Retain and rent

```
incremental cost          = TDC − land               (the land already held is excluded)
incremental gross rent    = projected gross rent − current gross rent
incremental net rent      = incremental gross rent − additional operating costs
yield on incremental cost = incremental net rent / incremental cost   (n/a if cost = 0)
interest at completion    = peakDebt × rate          (one year, interest-only)
cash flow after interest  = incremental net rent − interest at completion
valuation uplift          = assumed value on completion − land
uplift minus costs        = valuation uplift − incremental cost
```

Warnings when `uplift minus costs < 0` or `cash flow after interest < 0`.

## Sensitivity

- **Matrix:** build cost (`hard.construction` only) × {−15%, 0, +15%} against end value (sale
  value or value on completion) × {−15%, 0, +15%}: 9 cases.
- **Interest:** rate {−2, 0, +2} percentage points, floored at 0%.
- The headline metric is margin (develop and sell) or uplift minus costs (retain and rent).
- `negativeCases` counts negative headlines across the 9 matrix cases and the 2 shifted interest
  cases (11 in total; the base is counted once).

## Rounding

Money outputs are rounded to cents; ratios to 6 decimal places. Calculations use unrounded
intermediates, and the same input always produces the same output.

## Storage and provenance

- `scenarios.assumptions_json` holds the current assumptions, with `formula_version`.
- Every save appends a `scenario_results` row: `{ assumptions, result }` plus `formula_version`
  and `calculated_at`. Rows are append-only (no update or delete grants), giving a change history.
- Pages recalculate from the stored assumptions with the current formula, so displayed figures
  always match their inputs. If the formula version differs from the saved one, the page says so.

## Changelog

- `feasibility-1.0.0` (2026-10-29): initial version.

---

# Property comparison: `investment-1.0.0` (Blueprint v2.1)

Source of truth: `src/lib/compare/engine.ts`, tested in `src/lib/compare/compare.test.ts`. Pre-tax,
hypothetical and educational, not financial advice. Defaults are **examples**, identical for every
property (`DEFAULT_ASSUMPTIONS`). A figure that can't be calculated is **unknown with a reason**,
never 0.

## Inputs

Per property (facts): price (asking price, estimated value, or the user's hypothetical price, and
its source), weekly rent (and source), stamp duty (reviewed preset or the user's figure), open checks,
verified-evidence feasibility return on cost, licensed historical growth.

Global assumptions (per-property overrides for price, rent, duty, strata, rates, insurance, land tax):
deposit %, interest rate, loan term, principal-and-interest or interest-only, other purchase costs,
vacancy %, management % (of rent collected), insurance, council rates, strata, maintenance, land tax
(all per year), holding period (1–30 years), growth % p.a. for conservative / base / optimistic, rent
growth %, expense growth %.

## Year-1 figures

```
annual rent        = weekly rent × 52
collected rent     = annual rent × (1 − vacancy%)
operating costs    = collected rent × management% + insurance + council rates + strata + maintenance + land tax
net operating inc. = collected rent − operating costs
gross yield        = annual rent ÷ price
net yield          = net operating income ÷ price          (before finance and purchase costs)
loan               = price × (1 − deposit%)
cash required      = price × deposit% + stamp duty + other purchase costs
repayments         = 12 monthly payments: P&I = standard amortising payment over the term;
                     interest-only = balance × rate ÷ 12
cash flow (year 1) = net operating income − repayments     (pre-tax)
rate sensitivity   = year-1 cash flow with the rate −1, +1 and +2 percentage points
```

## Projections (each scenario, each year y = 1…holding period)

```
value_y        = price × (1 + growth%)^y
loan balance_y = amortisation schedule (monthly)
equity_y       = value_y − loan balance_y
cash flow_y    = rent × (1 + rent growth%)^(y−1) collected and less costs × (1 + expense growth%)^(y−1), less repayments
unrealised gain = value at the end − price
net return     = equity at the end + cumulative cash flow − cash required   (pre-tax, before selling costs)
```

Cash flow, equity and unrealised gain are reported separately. Tax, depreciation and CGT are not
modelled; any later tax inputs will be optional assumptions requiring an accountant's advice.

# Investment Match Score: `score-1.0.0`

Source: `src/lib/compare/score.ts`. Optional and transparent. Default weights: rental return 25,
affordability and cash flow 20, development feasibility 20, historical market indicators 15, risk 15,
data completeness 5; all adjustable. Each measure maps to 0–100 by a **fixed band** (linear, clamped),
so scores don't depend on which properties are being compared:

| Category | Measure | Band |
| --- | --- | --- |
| Rental return | gross yield | 2% → 0, 7% → 100 |
| Affordability and cash flow | year-1 cash flow ÷ cash required | −10% → 0, +5% → 100 |
| Development feasibility | return on cost of a scenario backed by **verified** planning evidence | 0% → 0, 25% → 100 |
| Historical market indicators | **licensed** historical growth % p.a. | 0% → 0, 8% → 100 |
| Risk | average of: cash flow at +2% rates ÷ cash required (−15% → 0, 0% → 100) and 100 − 20 per open check | |
| Data completeness | share of key data available | 0% → 0, 100% → 100 |

A category without evidence is **excluded** and labelled "Insufficient evidence"; it is never scored
as 0. `coverage` = scored weight ÷ total weight. Score = weighted average of scored categories, shown
only when coverage ≥ 60%; otherwise "Not enough evidence to score". Ties keep the user's order.

# Quick Compare best match: `quick-match-1.0.0`

Source: `src/lib/compare/quick.ts`. The user picks priorities; nothing else counts. For each priority
with at least two known values, the best property scores 1 and the worst 0, linearly in between
(equal values score the same). Points are summed; the highest total is the best match, and totals
within 0.05 are reported as a tie. Unknown values earn no points and are named in the explanation; a
priority with fewer than two known values is skipped. Measures: monthly repayments, price or
estimated value, gross yield, year-1 cash flow, cash required, bedrooms, land area.

## Development feasibility in Compare (stage C6)

Source: `src/lib/compare/development.ts`. The development category of the Investment Match Score
uses the return on cost (`feasibility-1.0.0`) of the most recently updated develop-and-sell scenario
in the viewer's workspace linked to the property, and only when (a) that workspace has at least one
verified, non-DEMO official planning record (planning certificate, planning portal record, LEP map
or council record) and (b) the scenario is complete (land value, build cost and assumed sale value
all above zero). Otherwise the category is "insufficient evidence" with the missing steps listed.
