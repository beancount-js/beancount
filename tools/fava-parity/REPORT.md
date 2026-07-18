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
| account_report | 116 | 28 |
| journal | 18 | 0 |
| query | 12 | 0 |
| ledger_data | 2 | 0 |
| **total** | **148** | **28** |

### Account-report breakdown

| Subcategory | Count | Meaning |
|---|---:|---|
| Shared-interval trees match (interval-set only) | 28 | Balances/changes agree for overlapping begins; JS interval bounds/count differ |
| Shared-interval tree value mismatch (at_cost) | 0 | Real rollup/booking divergence on overlapping intervals |
| Shared-interval tree value mismatch (at_value) | 0 | Likely price/conversion divergence |
| Exact pass (interval set + trees) | 116 | Full match after normalization |

## Key findings

1. **Account-report trees match on shared interval begins** (116 exact passes; 28 remaining fails are interval begin-set / count only — shared-interval inventory trees match for both AT_COST and AT_VALUE).
2. **Account-filtered journals match** after payee/empty-narration and AccountFilter alignment (18 passes).
3. **ledger_data.accounts match** Fava’s open/posted set without synthetic intermediate parents (2 passes).
4. **Queries match** after balances shell expansion and holdings GROUP BY fixes (12 passes).

## Disparities

### account_report — interval-set only (shared trees match) (28)

#### `example/accounts/account_report__Assets_US_ETrade_GLD__balances__month__at_cost.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: packages/fava Tree/LedgerData aggregation or @beancount-js/beancount booking
- Suggestion: Diff a single interval tree node for the failing account; if leaf units match but parents differ, fix Tree.insertBalance rollup; if leaves differ, fix booking/cost reduction first.
- Diff stats: 25 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 24
  },
  {
    "path": "interval_begins[0]",
    "expected": "2015-01-01",
    "actual": "2015-09-01"
  },
  {
    "path": "interval_begins[1]",
    "expected": "2015-02-01",
    "actual": "2015-10-01"
  },
  {
    "path": "interval_begins[2]",
    "expected": "2015-03-01",
    "actual": "2015-11-01"
  },
  {
    "path": "interval_begins[3]",
    "expected": "2015-04-01",
    "actual": "2015-12-01"
  },
  {
    "path": "interval_begins[4]",
    "expected": "2015-05-01",
    "actual": "2016-01-01"
  }
]
```

#### `example/accounts/account_report__Assets_US_ETrade_GLD__balances__month__at_value.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 25 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 24
  },
  {
    "path": "interval_begins[0]",
    "expected": "2015-01-01",
    "actual": "2015-09-01"
  },
  {
    "path": "interval_begins[1]",
    "expected": "2015-02-01",
    "actual": "2015-10-01"
  },
  {
    "path": "interval_begins[2]",
    "expected": "2015-03-01",
    "actual": "2015-11-01"
  },
  {
    "path": "interval_begins[3]",
    "expected": "2015-04-01",
    "actual": "2015-12-01"
  },
  {
    "path": "interval_begins[4]",
    "expected": "2015-05-01",
    "actual": "2016-01-01"
  }
]
```

#### `example/accounts/account_report__Assets_US_ETrade_GLD__changes__month__at_cost.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: packages/fava Tree/LedgerData aggregation or @beancount-js/beancount booking
- Suggestion: Diff a single interval tree node for the failing account; if leaf units match but parents differ, fix Tree.insertBalance rollup; if leaves differ, fix booking/cost reduction first.
- Diff stats: 25 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 24
  },
  {
    "path": "interval_begins[0]",
    "expected": "2015-01-01",
    "actual": "2015-09-01"
  },
  {
    "path": "interval_begins[1]",
    "expected": "2015-02-01",
    "actual": "2015-10-01"
  },
  {
    "path": "interval_begins[2]",
    "expected": "2015-03-01",
    "actual": "2015-11-01"
  },
  {
    "path": "interval_begins[3]",
    "expected": "2015-04-01",
    "actual": "2015-12-01"
  },
  {
    "path": "interval_begins[4]",
    "expected": "2015-05-01",
    "actual": "2016-01-01"
  }
]
```

#### `example/accounts/account_report__Assets_US_ETrade_GLD__changes__month__at_value.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 25 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 24
  },
  {
    "path": "interval_begins[0]",
    "expected": "2015-01-01",
    "actual": "2015-09-01"
  },
  {
    "path": "interval_begins[1]",
    "expected": "2015-02-01",
    "actual": "2015-10-01"
  },
  {
    "path": "interval_begins[2]",
    "expected": "2015-03-01",
    "actual": "2015-11-01"
  },
  {
    "path": "interval_begins[3]",
    "expected": "2015-04-01",
    "actual": "2015-12-01"
  },
  {
    "path": "interval_begins[4]",
    "expected": "2015-05-01",
    "actual": "2016-01-01"
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__balances__month__at_cost.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: packages/fava Tree/LedgerData aggregation or @beancount-js/beancount booking
- Suggestion: Diff a single interval tree node for the failing account; if leaf units match but parents differ, fix Tree.insertBalance rollup; if leaves differ, fix booking/cost reduction first.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 32
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__balances__month__at_value.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 32
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__changes__month__at_cost.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: packages/fava Tree/LedgerData aggregation or @beancount-js/beancount booking
- Suggestion: Diff a single interval tree node for the failing account; if leaf units match but parents differ, fix Tree.insertBalance rollup; if leaves differ, fix booking/cost reduction first.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 32
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__changes__month__at_value.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 33,
    "actual": 32
  }
]
```

_…and 20 more; see `out/summary.json`._

## Passing cases

Total passing: 148.

Passing case IDs are listed in `tools/fava-parity/out/summary.json`.

## Known non-goals

- HTML account journals from `account_report` (journal mode)
- Chart aesthetics / ChartSwitcher ordering
- URL routing, sidebar, and filter UI chrome
- Balance sheet / income statement / holdings pages (unless pointed to by a query failure)
- Exact dtype label strings when normalized types already match

## Recommended follow-ups

1. Align `LedgerData.dateRanges` / `intervalEnds` with Fava’s half-open intervals and first/last bounds so trailing extra periods disappear.
2. Investigate month interval begin-set length drift on account-filtered ledgers (trees already match on shared begins).
3. Regenerate with `pnpm fava-parity` after each fix; use year/at_cost leaf accounts as the fast inner loop.

## How to regenerate

```bash
cd tools/fava-parity
./run.sh
```

