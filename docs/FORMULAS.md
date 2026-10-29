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
