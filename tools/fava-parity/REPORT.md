# Fava Accounts/Queries Output Parity Report

## Setup

- Upstream Fava commit: `a80d04dc344c7142a53482dd67d54a9ba9f92e35`
- Fava CLI hint: 1.30.13 (installed CLI)
- Shared ledgers: `contrib/examples/example.beancount`, `tests/data/query-example.beancount`, `sample-budgets.beancount`
- Accounts: `Assets`, `Assets:US:BofA:Checking`, `Assets:US:Vanguard:RGAGX`, `Assets:US:ETrade:GLD`, `Liabilities`, `Equity`, `Income`, `Expenses`, `Expenses:Food:Restaurant`, `Expenses:Food:Groceries`, `Expenses:Financial:Fees`
- Intervals: year, month; conversions: at_cost, at_value
- Number tolerance: 0.0001 (inventories rounded; near-zero dropped)
- Comparison method: upstream Fava JSON API report endpoints vs JS `LedgerData` / `runBql` / Tree (same computation path as the SPA where applicable).
- Account trees are compared by interval **begin** date after normalizing inventories; half-open vs inclusive end encoding is treated as an interval-set issue when shared-begin trees match.
- Tree reports compare serialized trees only (charts omitted). Budgets on `account_report` are compared per account/interval begin.
- Visual/HTML journal markup, charts, editor/documents UI, and Studio-only routes are out of scope.

## Summary

| Category | Pass | Fail |
|---|---:|---:|
| account_report | 264 | 0 |
| journal | 33 | 0 |
| query | 38 | 0 |
| ledger_data | 3 | 0 |
| income_statement | 3 | 0 |
| balance_sheet | 3 | 0 |
| trial_balance | 3 | 0 |
| statistics | 3 | 0 |
| commodities | 3 | 0 |
| events | 3 | 0 |
| options | 3 | 0 |
| errors | 3 | 0 |
| **total** | **362** | **0** |

### Account-report breakdown

| Subcategory | Count | Meaning |
|---|---:|---|
| Shared-interval trees match (interval-set only) | 0 | Balances/changes agree for overlapping begins; JS interval bounds/count differ |
| Shared-interval tree value mismatch (at_cost) | 0 | Real rollup/booking divergence on overlapping intervals |
| Shared-interval tree value mismatch (at_value) | 0 | Likely price/conversion divergence |
| Exact pass (interval set + trees) | 264 | Full match after normalization |

## Key findings

1. **Account-report trees match on shared interval begins** (264 exact passes; 0 remaining fails are interval begin-set / count only — shared-interval inventory trees match for both AT_COST and AT_VALUE).
2. **Account-filtered journals match** after payee/empty-narration and AccountFilter alignment (33 passes).
3. **ledger_data.accounts match** Fava’s open/posted set without synthetic intermediate parents (3 passes).
4. **Queries match** after balances shell expansion and holdings GROUP BY fixes (38 passes).
5. **income_statement** matches (3 passes).
6. **balance_sheet** matches (3 passes).
7. **trial_balance** matches (3 passes).
8. **statistics** matches (3 passes).
9. **commodities** matches (3 passes).
10. **events** matches (3 passes).
11. **options** matches (3 passes).
12. **errors** matches (3 passes).

## Disparities

No disparities found under the current matrix.
## Passing cases

Total passing: 362.

Passing case IDs are listed in `tools/fava-parity/out/summary.json`.

## Known non-goals

- HTML account journals from `account_report` (journal mode)
- Chart aesthetics / ChartSwitcher ordering / chart payloads
- URL routing, sidebar, and filter UI chrome
- Documents FS ops, Import, Help, Editor source PUT protocol
- Studio-only routes (`/dashboard`, `/import/*`, `/records`)
- Exact dtype label strings when normalized types already match
- `SELECT type, count(type) FROM entries` price-row doubling in upstream Fava beanquery (covered via `/api/statistics` entries_by_type instead)
- Merging this fava-parity workspace tip into studio unless requested

## Recommended follow-ups

1. Regenerate with `pnpm fava-parity` after each fix; use year/at_cost leaf accounts as the fast inner loop.

## How to regenerate

```bash
cd tools/fava-parity
./run.sh
```

