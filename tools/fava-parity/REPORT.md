# Fava Accounts/Queries Output Parity Report

## Setup

- Upstream Fava commit: `a80d04dc344c7142a53482dd67d54a9ba9f92e35`
- Fava CLI hint: 1.30.13 (installed CLI)
- Shared ledgers: `contrib/examples/example.beancount`, `tests/data/query-example.beancount`
- Accounts: `Assets`, `Assets:US:BofA:Checking`, `Assets:US:Vanguard:RGAGX`, `Assets:US:ETrade:GLD`, `Liabilities`, `Equity`, `Income`, `Expenses`, `Expenses:Food:Restaurant`
- Intervals: year, month; conversions: at_cost, at_value
- Number tolerance: 0.0001 (inventories rounded; near-zero dropped)
- Comparison method: upstream Fava JSON API (`account_report`, `journal`, `query`, `ledger_data`) vs JS `LedgerData` / `runBql` (same computation path as the SPA).
- Account trees are compared by interval **begin** date after normalizing inventories; half-open vs inclusive end encoding is treated as an interval-set issue when shared-begin trees match.
- Visual/HTML journal markup, charts, and UI chrome are out of scope.

## Summary

| Category | Pass | Fail |
|---|---:|---:|
| account_report | 144 | 0 |
| journal | 18 | 0 |
| query | 12 | 0 |
| ledger_data | 2 | 0 |
| **total** | **176** | **0** |

### Account-report breakdown

| Subcategory | Count | Meaning |
|---|---:|---|
| Shared-interval trees match (interval-set only) | 0 | Balances/changes agree for overlapping begins; JS interval bounds/count differ |
| Shared-interval tree value mismatch (at_cost) | 0 | Real rollup/booking divergence on overlapping intervals |
| Shared-interval tree value mismatch (at_value) | 0 | Likely price/conversion divergence |
| Exact pass (interval set + trees) | 144 | Full match after normalization |

## Key findings

1. **Account-report trees match on shared interval begins** (144 exact passes; 0 remaining fails are interval begin-set / count only — shared-interval inventory trees match for both AT_COST and AT_VALUE).
2. **Account-filtered journals match** after payee/empty-narration and AccountFilter alignment (18 passes).
3. **ledger_data.accounts match** Fava’s open/posted set without synthetic intermediate parents (2 passes).
4. **Queries match** after balances shell expansion and holdings GROUP BY fixes (12 passes).

## Disparities

No disparities found under the current matrix.
## Passing cases

Total passing: 176.

Passing case IDs are listed in `tools/fava-parity/out/summary.json`.

## Known non-goals

- HTML account journals from `account_report` (journal mode)
- Chart aesthetics / ChartSwitcher ordering
- URL routing, sidebar, and filter UI chrome
- Balance sheet / income statement / holdings pages (unless pointed to by a query failure)
- Exact dtype label strings when normalized types already match

## Recommended follow-ups

1. Regenerate with `pnpm fava-parity` after each fix; use year/at_cost leaf accounts as the fast inner loop.

## How to regenerate

```bash
cd tools/fava-parity
./run.sh
```

