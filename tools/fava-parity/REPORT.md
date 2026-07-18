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
| account_report | 2 | 142 |
| journal | 10 | 8 |
| query | 6 | 6 |
| ledger_data | 0 | 2 |
| **total** | **18** | **158** |

### Account-report breakdown

| Subcategory | Count | Meaning |
|---|---:|---|
| Shared-interval trees match (interval-set only) | 118 | Balances/changes agree for overlapping begins; JS interval bounds/count differ |
| Shared-interval tree value mismatch (at_cost) | 0 | Real rollup/booking divergence on overlapping intervals |
| Shared-interval tree value mismatch (at_value) | 24 | Likely price/conversion divergence |
| Exact pass (interval set + trees) | 2 | Full match after normalization |

## Key findings

1. **AT_COST account trees largely match Fava on shared interval begins.** Most account_report “failures” are interval boundary/count differences (JS often emits an extra trailing period and uses inclusive period ends; Fava uses half-open `[begin, end)`).
2. **AT_VALUE trees diverge on priced commodities** (e.g. `Assets:US:ETrade:GLD`, `Assets:US:Vanguard:RGAGX`). Example year snapshot for GLD 2015-01-01: Fava `USD 2029.60` vs JS `USD 2090`.
3. **Beanquery `balances` shell command fails** (`Invalid query stack(0)`), while Fava returns a full balances table. Saved `balances` queries on `query-example` hit the same bug.
4. **SELECT-style queries are much closer** after Inventory/date normalization; remaining issues include holdings-style GROUP BY row counts and some Decimal/type labeling differences.
5. **Account lists differ**: JS includes intermediate parent accounts (e.g. `Assets`, `Assets:US`) that Fava’s `ledger_data.accounts` omits; JS also reports a larger set overall.
6. **Account-filtered journals** still disagree on entry membership/fingerprint after reducing to open/close/txn/balance/pad/note/document — filter semantics or directive coverage differ.

## Disparities

### account_report — shared tree value mismatches (24)

#### `example/accounts/account_report__Assets_US_ETrade_GLD__balances__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-02-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-03-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-04-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-05-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-06-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  }
]
```

#### `example/accounts/account_report__Assets_US_ETrade_GLD__balances__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 8 paths (inventory-ish 7, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2016-01-01.balance.USD",
    "expected": 4298.62,
    "actual": 3658.46
  },
  {
    "path": "interval_balances.2016-01-01.balance_children.USD",
    "expected": 4298.62,
    "actual": 3658.46
  },
  {
    "path": "interval_balances.2017-01-01.balance.USD",
    "expected": 5217.47,
    "actual": 4559.8
  },
  {
    "path": "interval_balances.2017-01-01.balance_children.USD",
    "expected": 5217.47,
    "actual": 4559.8
  }
]
```

#### `example/accounts/account_report__Assets_US_ETrade_GLD__changes__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 20, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-02-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-03-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-04-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-05-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2015-06-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  }
]
```

#### `example/accounts/account_report__Assets_US_ETrade_GLD__changes__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 8 paths (inventory-ish 7, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2016-01-01.balance.USD",
    "expected": 1770.02,
    "actual": 1568.46
  },
  {
    "path": "interval_balances.2016-01-01.balance_children.USD",
    "expected": 1770.02,
    "actual": 1568.46
  },
  {
    "path": "interval_balances.2017-01-01.balance.USD",
    "actual": 901.34
  },
  {
    "path": "interval_balances.2017-01-01.balance_children.USD",
    "actual": 901.34
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__balances__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-02-01.balance.USD",
    "expected": 4240.2222,
    "actual": 4320.0567
  },
  {
    "path": "interval_balances.2015-02-01.balance_children.USD",
    "expected": 4240.2222,
    "actual": 4320.0567
  },
  {
    "path": "interval_balances.2015-03-01.balance.USD",
    "expected": 7338.8597,
    "actual": 7559.974700000001
  },
  {
    "path": "interval_balances.2015-03-01.balance_children.USD",
    "expected": 7338.8597,
    "actual": 7559.974700000001
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__balances__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 8 paths (inventory-ish 7, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance.USD",
    "expected": 15663.015200000002,
    "actual": 16199.9884
  },
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 15663.015200000002,
    "actual": 16199.9884
  },
  {
    "path": "interval_balances.2016-01-01.balance.USD",
    "expected": 32341.8675,
    "actual": 32399.6307
  },
  {
    "path": "interval_balances.2016-01-01.balance_children.USD",
    "expected": 32341.8675,
    "actual": 32399.6307
  },
  {
    "path": "interval_balances.2017-01-01.balance.USD",
    "expected": 48471.3853,
    "actual": 49049.6661
  },
  {
    "path": "interval_balances.2017-01-01.balance_children.USD",
    "expected": 48471.3853,
    "actual": 49049.6661
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__changes__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-02-01.balance.USD",
    "expected": 2125.3083,
    "actual": 2160.0171
  },
  {
    "path": "interval_balances.2015-02-01.balance_children.USD",
    "expected": 2125.3083,
    "actual": 2160.0171
  },
  {
    "path": "interval_balances.2015-03-01.balance.USD",
    "expected": 3196.052,
    "actual": 3239.918
  },
  {
    "path": "interval_balances.2015-03-01.balance_children.USD",
    "expected": 3196.052,
    "actual": 3239.918
  }
]
```

#### `example/accounts/account_report__Assets_US_Vanguard_RGAGX__changes__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 8 paths (inventory-ish 7, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance.USD",
    "expected": 15663.015200000002,
    "actual": 16199.9884
  },
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 15663.015200000002,
    "actual": 16199.9884
  },
  {
    "path": "interval_balances.2016-01-01.balance.USD",
    "expected": 16216.323,
    "actual": 16199.6424
  },
  {
    "path": "interval_balances.2016-01-01.balance_children.USD",
    "expected": 16216.323,
    "actual": 16199.6424
  },
  {
    "path": "interval_balances.2017-01-01.balance.USD",
    "expected": 16461.1078,
    "actual": 16650.0354
  },
  {
    "path": "interval_balances.2017-01-01.balance_children.USD",
    "expected": 16461.1078,
    "actual": 16650.0354
  }
]
```

#### `example/accounts/account_report__Assets__balances__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 10254.5872,
    "actual": 10244.0718
  },
  {
    "path": "interval_balances.2015-01-01.children[0].balance_children.USD",
    "expected": 10254.5872,
    "actual": 10244.0718
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].balance_children.USD",
    "expected": 5410.5172,
    "actual": 5400.0018
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].children[1].balance.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].children[1].balance_children.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].children[2].balance.USD",
    "expected": 1465.5916,
    "actual": 1439.9823000000001
  }
]
```

#### `example/accounts/account_report__Assets__balances__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 44462.2057,
    "actual": 43567.4835
  },
  {
    "path": "interval_balances.2015-01-01.children[0].balance_children.USD",
    "expected": 44462.2057,
    "actual": 43567.4835
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].balance_children.USD",
    "expected": 8538.78,
    "actual": 8537.6
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].children[1].balance.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].children[1].balance_children.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].children[2].balance.USD",
    "expected": 1104.1200000000001,
    "actual": 1059.48
  }
]
```

#### `example/accounts/account_report__Assets__changes__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 10254.5872,
    "actual": 10244.0718
  },
  {
    "path": "interval_balances.2015-01-01.children[0].balance_children.USD",
    "expected": 10254.5872,
    "actual": 10244.0718
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].balance_children.USD",
    "expected": 5410.5172,
    "actual": 5400.0018
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].children[1].balance.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].children[1].balance_children.USD",
    "expected": 2144.9456,
    "actual": 2160.0395000000003
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[4].children[2].balance.USD",
    "expected": 1465.5916,
    "actual": 1439.9823000000001
  }
]
```

#### `example/accounts/account_report__Assets__changes__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2015-01-01.balance_children.USD",
    "expected": 44462.2057,
    "actual": 43567.4835
  },
  {
    "path": "interval_balances.2015-01-01.children[0].balance_children.USD",
    "expected": 44462.2057,
    "actual": 43567.4835
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].balance_children.USD",
    "expected": 8538.78,
    "actual": 8537.6
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].children[1].balance.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].children[1].balance_children.USD",
    "expected": 2029.6000000000001,
    "actual": 2090
  },
  {
    "path": "interval_balances.2015-01-01.children[0].children[1].children[2].balance.USD",
    "expected": 1104.1200000000001,
    "actual": 1059.48
  }
]
```

#### `query-example/accounts/account_report__Assets_US_ETrade_GLD__balances__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 23 paths (inventory-ish 16, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-02-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-03-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-04-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-05-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-06-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  }
]
```

#### `query-example/accounts/account_report__Assets_US_ETrade_GLD__balances__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 4 paths (inventory-ish 3, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2011-01-01",
    "actual": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {
        "USD": 1998.66
      },
      "balance_children": {
        "USD": 1998.66
      },
      "children": []
    }
  },
  {
    "path": "interval_begins.length",
    "expected": 1,
    "actual": 2
  }
]
```

#### `query-example/accounts/account_report__Assets_US_ETrade_GLD__changes__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 21 paths (inventory-ish 14, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-02-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-03-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-04-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-05-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_balances.2010-06-01",
    "expected": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  }
]
```

#### `query-example/accounts/account_report__Assets_US_ETrade_GLD__changes__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 4 paths (inventory-ish 3, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2011-01-01",
    "actual": {
      "account": "Assets:US:ETrade:GLD",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_begins.length",
    "expected": 1,
    "actual": 2
  }
]
```

#### `query-example/accounts/account_report__Assets_US_Vanguard_RGAGX__balances__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 21 paths (inventory-ish 20, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-02-01.balance.USD",
    "expected": 4319.1533,
    "actual": 4320.0560000000005
  },
  {
    "path": "interval_balances.2010-02-01.balance_children.USD",
    "expected": 4319.1533,
    "actual": 4320.0560000000005
  },
  {
    "path": "interval_balances.2010-03-01.balance.USD",
    "expected": 6659.1897,
    "actual": 6480.124900000001
  },
  {
    "path": "interval_balances.2010-03-01.balance_children.USD",
    "expected": 6659.1897,
    "actual": 6480.124900000001
  }
]
```

#### `query-example/accounts/account_report__Assets_US_Vanguard_RGAGX__balances__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 4 paths (inventory-ish 3, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance.USD",
    "expected": 15120.141500000002,
    "actual": 14850.020400000001
  },
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 15120.141500000002,
    "actual": 14850.020400000001
  },
  {
    "path": "interval_balances.2011-01-01",
    "actual": {
      "account": "Assets:US:Vanguard:RGAGX",
      "balance": {
        "USD": 14850.020400000001
      },
      "balance_children": {
        "USD": 14850.020400000001
      },
      "children": []
    }
  },
  {
    "path": "interval_begins.length",
    "expected": 1,
    "actual": 2
  }
]
```

#### `query-example/accounts/account_report__Assets_US_Vanguard_RGAGX__changes__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 19 paths (inventory-ish 18, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-02-01.balance.USD",
    "expected": 2134.607,
    "actual": 2160.0551
  },
  {
    "path": "interval_balances.2010-02-01.balance_children.USD",
    "expected": 2134.607,
    "actual": 2160.0551
  },
  {
    "path": "interval_balances.2010-03-01.balance.USD",
    "expected": 2213.8847,
    "actual": 2160.0689
  },
  {
    "path": "interval_balances.2010-03-01.balance_children.USD",
    "expected": 2213.8847,
    "actual": 2160.0689
  }
]
```

#### `query-example/accounts/account_report__Assets_US_Vanguard_RGAGX__changes__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 4 paths (inventory-ish 3, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance.USD",
    "expected": 15120.141500000002,
    "actual": 14850.020400000001
  },
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 15120.141500000002,
    "actual": 14850.020400000001
  },
  {
    "path": "interval_balances.2011-01-01",
    "actual": {
      "account": "Assets:US:Vanguard:RGAGX",
      "balance": {},
      "balance_children": {},
      "children": []
    }
  },
  {
    "path": "interval_begins.length",
    "expected": 1,
    "actual": 2
  }
]
```

#### `query-example/accounts/account_report__Assets__balances__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 7863.2241,
    "actual": 7825.7397
  },
  {
    "path": "interval_balances.2010-01-01.children[0].balance_children.USD",
    "expected": 7863.2241,
    "actual": 7825.7397
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].balance_children.USD",
    "expected": 3637.5041,
    "actual": 3600.0197000000003
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].children[1].balance.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].children[1].balance_children.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].children[2].balance.USD",
    "expected": 1444.569,
    "actual": 1439.9587000000001
  }
]
```

#### `query-example/accounts/account_report__Assets__balances__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 18 paths (inventory-ish 17, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 44069.6993,
    "actual": 44219.8868
  },
  {
    "path": "interval_balances.2010-01-01.children[0].balance_children.USD",
    "expected": 44069.6993,
    "actual": 44219.8868
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].balance_children.USD",
    "expected": 18997.63,
    "actual": 18967.600000000002
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].children[1].balance.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].children[1].balance_children.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].children[2].balance.USD",
    "expected": 6102,
    "actual": 6170.3
  }
]
```

#### `query-example/accounts/account_report__Assets__changes__month__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 40 paths (inventory-ish 40, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 7863.2241,
    "actual": 7825.7397
  },
  {
    "path": "interval_balances.2010-01-01.children[0].balance_children.USD",
    "expected": 7863.2241,
    "actual": 7825.7397
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].balance_children.USD",
    "expected": 3637.5041,
    "actual": 3600.0197000000003
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].children[1].balance.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].children[1].balance_children.USD",
    "expected": 2192.8751,
    "actual": 2160.001
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[4].children[2].balance.USD",
    "expected": 1444.569,
    "actual": 1439.9587000000001
  }
]
```

#### `query-example/accounts/account_report__Assets__changes__year__at_value.json`

- Shared-interval trees: **mismatch**
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 18 paths (inventory-ish 17, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_balances.2010-01-01.balance_children.USD",
    "expected": 44069.6993,
    "actual": 44219.8868
  },
  {
    "path": "interval_balances.2010-01-01.children[0].balance_children.USD",
    "expected": 44069.6993,
    "actual": 44219.8868
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].balance_children.USD",
    "expected": 18997.63,
    "actual": 18967.600000000002
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].children[1].balance.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].children[1].balance_children.USD",
    "expected": 2048.9,
    "actual": 1998.66
  },
  {
    "path": "interval_balances.2010-01-01.children[0].children[1].children[2].balance.USD",
    "expected": 6102,
    "actual": 6170.3
  }
]
```

### account_report — interval-set only (shared trees match) (118)

#### `example/accounts/account_report__Assets_US_BofA_Checking__balances__month__at_cost.json`

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
    "actual": 34
  }
]
```

#### `example/accounts/account_report__Assets_US_BofA_Checking__balances__month__at_value.json`

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
    "actual": 34
  }
]
```

#### `example/accounts/account_report__Assets_US_BofA_Checking__balances__year__at_cost.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: packages/fava Tree/LedgerData aggregation or @beancount-js/beancount booking
- Suggestion: Diff a single interval tree node for the failing account; if leaf units match but parents differ, fix Tree.insertBalance rollup; if leaves differ, fix booking/cost reduction first.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 3,
    "actual": 4
  }
]
```

#### `example/accounts/account_report__Assets_US_BofA_Checking__balances__year__at_value.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 3,
    "actual": 4
  }
]
```

#### `example/accounts/account_report__Assets_US_BofA_Checking__changes__month__at_cost.json`

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
    "actual": 34
  }
]
```

#### `example/accounts/account_report__Assets_US_BofA_Checking__changes__month__at_value.json`

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
    "actual": 34
  }
]
```

#### `example/accounts/account_report__Assets_US_BofA_Checking__changes__year__at_cost.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: packages/fava Tree/LedgerData aggregation or @beancount-js/beancount booking
- Suggestion: Diff a single interval tree node for the failing account; if leaf units match but parents differ, fix Tree.insertBalance rollup; if leaves differ, fix booking/cost reduction first.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 3,
    "actual": 4
  }
]
```

#### `example/accounts/account_report__Assets_US_BofA_Checking__changes__year__at_value.json`

- Shared-interval trees: **match** (failure is interval begin set / bounds)
- Likely layer: @beancount-js/beancount price/conversion (AT_VALUE)
- Suggestion: Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.
- Diff stats: 1 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "interval_begins.length",
    "expected": 3,
    "actual": 4
  }
]
```

_…and 110 more; see `out/summary.json`._

### query (6)

#### `example/queries/balances.json`

- Likely layer: @beancount-js/beanquery (result shape / aggregation)
- Suggestion: Add a beanquery fixture for this BQL against the shared ledger; align column dtypes and Inventory/Position cell encoding with Fava’s query JSON serializer.
- Diff stats: 4 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "error",
    "actual": "Invalid query stack(0)"
  },
  {
    "path": "rows",
    "expected": [
      [
        "Assets:US:BofA:Checking",
        {
          "USD": 2754.06
        }
      ],
      [
        "Assets:US:ETrade:Cash",
        {
          "USD": 855.83
        }
      ],
      [
        "Assets:US:ETrade:GLD",
        {
          "GLD": 17
        }
      ],
      [
        "Assets:US:ETrade:ITOT",
        {
          "ITOT": 104
        }
      ],
      [
        "Assets:US:ETrade:VEA",
        {
          "VEA": 36
        }
      ],
      [
        "Assets:US:ETrade:VHT",
        {
          "VHT": 64
        }
      ],
      [
        "Assets:US:Federal:PreTax401k",
        {}
      ],
      [
        "Assets:US:Hoogle:Vacation",
        {
          "VACHR": -13
        }
      ],
      [
        "Assets:US:Vanguard:Cash",
        {
          "USD": -0.02
        }
      ],
      [
        "Assets:US:Vanguard:RGAGX",
        {
          "RGAGX": 597.748
        }
      ],
      [
        "Assets:US:Vanguard:VBMPX",
        {
          "VBMPX": 193.442
        }
      ],
      [
        "Equity:Opening-Balances",
        {
          "USD": -3490.52
        }
      ],
      [
        "Expenses:Financial:Commissions",
        {
          "USD": 250.60000000000002
        }
      ],
      [
        "Expenses:Financial:Fees",
        {
          "USD": 132
        }
      ],
      [
        "Expenses:Food:Alcohol",
        {
          "USD": 63.580000000000005
        }
      ],
      [
        "Expenses:Food:Coffee",
        {
          "USD": 76.98
        }
      ],
      [
        "Expenses:Food:Groceries",
        {
          "USD": 5936.42
        }
      ],
      [
        "Expenses:Food:Restaurant",
        {
          "USD": 12083.83
        }
      ],
      [
        "Expenses:Health:Dental:Insurance",
        {
          "USD": 205.9
        }
      ],
      [
        "Expenses:Health:Life:GroupTermLife",
        {
          "USD": 1726.72
        }
      ],
      [
        "Expenses:Health:Medical:Insurance",
        {
          "USD": 1943.98
        }
      ],
      [
        "Expenses:Health:Vision:Insurance",
        {
          "USD": 3003.3
        }
      ],
      [
        "Expenses:Home:Electricity",
        {
          "USD": 2080
        }
      ],
      [
        "Expenses:Home:Internet",
        {
          "USD": 2559.51
        }
      ],
      [
        "Expenses:Home:Phone",
        {
          "USD": 2011.73
        }
      ],
      [
        "Expenses:Home:Rent",
        {
          "USD": 76800
        }
      ],
      [
        "Expenses:Taxes:Y2015:US:CityNYC",
        {
          "USD": 4722.84
        }
      ],
      [
        "Expenses:Taxes:Y2015:US:Federal:PreTax401k",
        {
          "IRAUSD": 18000
        }
      ],
      [
        "Expenses:Taxes:Y2015:US:Federal",
        {
          "USD": 28994.07
        }
      ],
      [
        "Expenses:Taxes:Y2015:US:Medicare",
        {
          "USD": 2878.7400000000002
        }
      ],
      [
        "Expenses:Taxes:Y2015:US:SDI",
        {
          "USD": 30.240000000000002
        }
      ],
      [
        "Expenses:Taxes:Y2015:US:SocSec",
        {
          "USD": 7000.04
        }
      ],
      [
        "Expenses:Taxes:Y2015:US:State",
        {
          "USD": 10132.08
        }
      ],
      [
        "Expenses:Taxes:Y2016:US:CityNYC",
        {
          "USD": 4547.92
        }
      ],
      [
        "Expenses:Taxes:Y2016:US:Federal:PreTax401k",
        {
          "IRAUSD": 18000
        }
      ],
      [
        "Expenses:Taxes:Y2016:US:Federal",
        {
          "USD": 28099.08
        }
      ],
      [
        "Expenses:Taxes:Y2016:US:Medicare",
        {
          "USD": 2772.1200000000003
        }
      ],
      [
        "Expenses:Taxes:Y2016:US:SDI",
        {
          "USD": 29.12
        }
      ],
      [
        "Expenses:Taxes:Y2016:US:SocSec",
        {
          "USD": 7000.04
        }
      ],
      [
        "Expenses:Taxes:Y2016:US:State",
        {
          "USD": 9948.61
        }
      ],
      [
        "Expenses:Taxes:Y2017:US:CityNYC",
        {
          "USD": 3148.56
        }
      ],
      [
        "Expenses:Taxes:Y2017:US:Federal:PreTax401k",
        {
          "IRAUSD": 18500
        }
      ],
      [
        "Expenses:Taxes:Y2017:US:Federal",
        {
          "USD": 19132.56
        }
      ],
      [
        "Expenses:Taxes:Y2017:US:Medicare",
        {
          "USD": 1919.16
        }
      ],
      [
        "Expenses:Taxes:Y2017:US:SDI",
        {
          "USD": 20.16
        }
      ],
      [
        "Expenses:Taxes:Y2017:US:SocSec",
        {
          "USD": 5067.72
        }
      ],
      [
        "Expenses:Taxes:Y2017:US:State",
        {
          "USD": 6571.4400000000005
        }
      ],
      [
        "Expenses:Transport:Tram",
        {
          "USD": 3720
        }
      ],
      [
        "Expenses:Vacation",
        {
          "VACHR": 368
        }
      ],
      [
        "Income:US:ETrade:Dividends",
        {
          "USD": -479.46000000000004
        }
      ],
      [
        "Income:US:ETrade:Gains",
        {
          "USD": -796.4200000000001
        }
      ],
      [
        "Income:US:Federal:PreTax401k",
        {
          "IRAUSD": -54500
        }
      ],
      [
        "Income:US:Hoogle:GroupTermLife",
        {
          "USD": -1726.72
        }
      ],
      [
        "Income:US:Hoogle:Match401k",
        {
          "USD": -27250
        }
      ],
      [
        "Income:US:Hoogle:Salary",
        {
          "USD": -327691.98000000004
        }
      ],
      [
        "Income:US:Hoogle:Vacation",
        {
          "VACHR": -355
        }
      ],
      [
        "Liabilities:AccountsPayable",
        {}
      ],
      [
        "Liabilities:US:Chase:Slate",
        {
          "USD": -2703.29
        }
      ]
    ]
  },
  {
    "path": "t",
    "expected": "table",
    "actual": "error"
  },
  {
    "path": "types",
    "expected": [
      {
        "name": "account",
        "dtype": "str"
      },
      {
        "name": "sum((position))",
        "dtype": "inventory"
      }
    ]
  }
]
```

#### `example/queries/holdings-style.json`

- Likely layer: @beancount-js/beanquery (result shape / aggregation)
- Suggestion: Add a beanquery fixture for this BQL against the shared ledger; align column dtypes and Inventory/Position cell encoding with Fava’s query JSON serializer.
- Diff stats: 40 paths (inventory-ish 12, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "rows.length",
    "expected": 167,
    "actual": 259
  },
  {
    "path": "rows[0][1].USD",
    "expected": 2754.06
  },
  {
    "path": "rows[0][1].cost",
    "actual": null
  },
  {
    "path": "rows[0][1].units",
    "actual": {
      "number": 2754.06,
      "currency": "USD"
    }
  },
  {
    "path": "rows[1][1].USD",
    "expected": 855.83
  },
  {
    "path": "rows[1][1].cost",
    "actual": null
  }
]
```

#### `query-example/queries/balances.json`

- Likely layer: @beancount-js/beanquery (result shape / aggregation)
- Suggestion: Add a beanquery fixture for this BQL against the shared ledger; align column dtypes and Inventory/Position cell encoding with Fava’s query JSON serializer.
- Diff stats: 4 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "error",
    "actual": "Invalid query stack(0)"
  },
  {
    "path": "rows",
    "expected": [
      [
        "Assets:US:BofA:Checking",
        {
          "USD": 502.25
        }
      ],
      [
        "Assets:US:ETrade:Cash",
        {
          "USD": 8689.74
        }
      ],
      [
        "Assets:US:ETrade:GLD",
        {
          "GLD": 10
        }
      ],
      [
        "Assets:US:ETrade:ITOT",
        {
          "ITOT": 60
        }
      ],
      [
        "Assets:US:ETrade:VEA",
        {
          "VEA": 4
        }
      ],
      [
        "Assets:US:ETrade:VHT",
        {
          "VHT": 23
        }
      ],
      [
        "Assets:US:Federal:PreTax401k",
        {}
      ],
      [
        "Assets:US:Hoogle:Vacation",
        {
          "VACHR": 130
        }
      ],
      [
        "Assets:US:Vanguard:Cash",
        {
          "USD": 0.04
        }
      ],
      [
        "Assets:US:Vanguard:RGAGX",
        {
          "RGAGX": 103.322
        }
      ],
      [
        "Assets:US:Vanguard:VBMPX",
        {
          "VBMPX": 63.276
        }
      ],
      [
        "Equity:Opening-Balances",
        {
          "USD": -4363.280000000001
        }
      ],
      [
        "Expenses:Financial:Commissions",
        {
          "USD": 179
        }
      ],
      [
        "Expenses:Financial:Fees",
        {
          "USD": 48
        }
      ],
      [
        "Expenses:Food:Groceries",
        {
          "USD": 2196.8
        }
      ],
      [
        "Expenses:Food:Restaurant",
        {
          "USD": 3795.1800000000003
        }
      ],
      [
        "Expenses:Health:Dental:Insurance",
        {
          "USD": 75.4
        }
      ],
      [
        "Expenses:Health:Life:GroupTermLife",
        {
          "USD": 632.32
        }
      ],
      [
        "Expenses:Health:Medical:Insurance",
        {
          "USD": 711.88
        }
      ],
      [
        "Expenses:Health:Vision:Insurance",
        {
          "USD": 1099.8
        }
      ],
      [
        "Expenses:Home:Electricity",
        {
          "USD": 715
        }
      ],
      [
        "Expenses:Home:Internet",
        {
          "USD": 879.86
        }
      ],
      [
        "Expenses:Home:Phone",
        {
          "USD": 666.23
        }
      ],
      [
        "Expenses:Home:Rent",
        {
          "USD": 26400
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:CityNYC",
        {
          "USD": 4547.92
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Federal:PreTax401k",
        {
          "IRAUSD": 16500
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Federal",
        {
          "USD": 27635.920000000002
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Medicare",
        {
          "USD": 2772.1200000000003
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:SDI",
        {
          "USD": 29.12
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:SocSec",
        {
          "USD": 7000.04
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:State",
        {
          "USD": 9492.08
        }
      ],
      [
        "Expenses:Transport:Tram",
        {
          "USD": 1440
        }
      ],
      [
        "Income:US:ETrade:Dividends",
        {
          "USD": -70.55
        }
      ],
      [
        "Income:US:ETrade:Gains",
        {
          "USD": -76.05
        }
      ],
      [
        "Income:US:Federal:PreTax401k",
        {
          "IRAUSD": -16500
        }
      ],
      [
        "Income:US:Hoogle:GroupTermLife",
        {
          "USD": -632.32
        }
      ],
      [
        "Income:US:Hoogle:Match401k",
        {
          "USD": -8250
        }
      ],
      [
        "Income:US:Hoogle:Salary",
        {
          "USD": -119999.88
        }
      ],
      [
        "Income:US:Hoogle:Vacation",
        {
          "VACHR": -130
        }
      ],
      [
        "Liabilities:US:Chase:Slate",
        {
          "USD": -1144.44
        }
      ]
    ]
  },
  {
    "path": "t",
    "expected": "table",
    "actual": "error"
  },
  {
    "path": "types",
    "expected": [
      {
        "name": "account",
        "dtype": "str"
      },
      {
        "name": "sum((position))",
        "dtype": "inventory"
      }
    ]
  }
]
```

#### `query-example/queries/holdings-style.json`

- Likely layer: @beancount-js/beanquery (result shape / aggregation)
- Suggestion: Add a beanquery fixture for this BQL against the shared ledger; align column dtypes and Inventory/Position cell encoding with Fava’s query JSON serializer.
- Diff stats: 40 paths (inventory-ish 12, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "rows.length",
    "expected": 79,
    "actual": 107
  },
  {
    "path": "rows[0][1].USD",
    "expected": 502.25
  },
  {
    "path": "rows[0][1].cost",
    "actual": null
  },
  {
    "path": "rows[0][1].units",
    "actual": {
      "number": 502.25,
      "currency": "USD"
    }
  },
  {
    "path": "rows[1][1].USD",
    "expected": 8689.74
  },
  {
    "path": "rows[1][1].cost",
    "actual": null
  }
]
```

#### `query-example/queries/saved__custom query with space.json`

- Likely layer: @beancount-js/beanquery (result shape / aggregation)
- Suggestion: Add a beanquery fixture for this BQL against the shared ledger; align column dtypes and Inventory/Position cell encoding with Fava’s query JSON serializer.
- Diff stats: 4 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "error",
    "actual": "Invalid query stack(0)"
  },
  {
    "path": "rows",
    "expected": [
      [
        "Assets:US:BofA:Checking",
        {
          "USD": 502.25
        }
      ],
      [
        "Assets:US:ETrade:Cash",
        {
          "USD": 8689.74
        }
      ],
      [
        "Assets:US:ETrade:GLD",
        {
          "GLD": 10
        }
      ],
      [
        "Assets:US:ETrade:ITOT",
        {
          "ITOT": 60
        }
      ],
      [
        "Assets:US:ETrade:VEA",
        {
          "VEA": 4
        }
      ],
      [
        "Assets:US:ETrade:VHT",
        {
          "VHT": 23
        }
      ],
      [
        "Assets:US:Federal:PreTax401k",
        {}
      ],
      [
        "Assets:US:Hoogle:Vacation",
        {
          "VACHR": 130
        }
      ],
      [
        "Assets:US:Vanguard:Cash",
        {
          "USD": 0.04
        }
      ],
      [
        "Assets:US:Vanguard:RGAGX",
        {
          "RGAGX": 103.322
        }
      ],
      [
        "Assets:US:Vanguard:VBMPX",
        {
          "VBMPX": 63.276
        }
      ],
      [
        "Equity:Opening-Balances",
        {
          "USD": -4363.280000000001
        }
      ],
      [
        "Expenses:Financial:Commissions",
        {
          "USD": 179
        }
      ],
      [
        "Expenses:Financial:Fees",
        {
          "USD": 48
        }
      ],
      [
        "Expenses:Food:Groceries",
        {
          "USD": 2196.8
        }
      ],
      [
        "Expenses:Food:Restaurant",
        {
          "USD": 3795.1800000000003
        }
      ],
      [
        "Expenses:Health:Dental:Insurance",
        {
          "USD": 75.4
        }
      ],
      [
        "Expenses:Health:Life:GroupTermLife",
        {
          "USD": 632.32
        }
      ],
      [
        "Expenses:Health:Medical:Insurance",
        {
          "USD": 711.88
        }
      ],
      [
        "Expenses:Health:Vision:Insurance",
        {
          "USD": 1099.8
        }
      ],
      [
        "Expenses:Home:Electricity",
        {
          "USD": 715
        }
      ],
      [
        "Expenses:Home:Internet",
        {
          "USD": 879.86
        }
      ],
      [
        "Expenses:Home:Phone",
        {
          "USD": 666.23
        }
      ],
      [
        "Expenses:Home:Rent",
        {
          "USD": 26400
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:CityNYC",
        {
          "USD": 4547.92
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Federal:PreTax401k",
        {
          "IRAUSD": 16500
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Federal",
        {
          "USD": 27635.920000000002
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Medicare",
        {
          "USD": 2772.1200000000003
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:SDI",
        {
          "USD": 29.12
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:SocSec",
        {
          "USD": 7000.04
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:State",
        {
          "USD": 9492.08
        }
      ],
      [
        "Expenses:Transport:Tram",
        {
          "USD": 1440
        }
      ],
      [
        "Income:US:ETrade:Dividends",
        {
          "USD": -70.55
        }
      ],
      [
        "Income:US:ETrade:Gains",
        {
          "USD": -76.05
        }
      ],
      [
        "Income:US:Federal:PreTax401k",
        {
          "IRAUSD": -16500
        }
      ],
      [
        "Income:US:Hoogle:GroupTermLife",
        {
          "USD": -632.32
        }
      ],
      [
        "Income:US:Hoogle:Match401k",
        {
          "USD": -8250
        }
      ],
      [
        "Income:US:Hoogle:Salary",
        {
          "USD": -119999.88
        }
      ],
      [
        "Income:US:Hoogle:Vacation",
        {
          "VACHR": -130
        }
      ],
      [
        "Liabilities:US:Chase:Slate",
        {
          "USD": -1144.44
        }
      ]
    ]
  },
  {
    "path": "t",
    "expected": "table",
    "actual": "error"
  },
  {
    "path": "types",
    "expected": [
      {
        "name": "account",
        "dtype": "str"
      },
      {
        "name": "sum((position))",
        "dtype": "inventory"
      }
    ]
  }
]
```

#### `query-example/queries/saved__custom_query.json`

- Likely layer: @beancount-js/beanquery (result shape / aggregation)
- Suggestion: Add a beanquery fixture for this BQL against the shared ledger; align column dtypes and Inventory/Position cell encoding with Fava’s query JSON serializer.
- Diff stats: 4 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "error",
    "actual": "Invalid query stack(0)"
  },
  {
    "path": "rows",
    "expected": [
      [
        "Assets:US:BofA:Checking",
        {
          "USD": 502.25
        }
      ],
      [
        "Assets:US:ETrade:Cash",
        {
          "USD": 8689.74
        }
      ],
      [
        "Assets:US:ETrade:GLD",
        {
          "GLD": 10
        }
      ],
      [
        "Assets:US:ETrade:ITOT",
        {
          "ITOT": 60
        }
      ],
      [
        "Assets:US:ETrade:VEA",
        {
          "VEA": 4
        }
      ],
      [
        "Assets:US:ETrade:VHT",
        {
          "VHT": 23
        }
      ],
      [
        "Assets:US:Federal:PreTax401k",
        {}
      ],
      [
        "Assets:US:Hoogle:Vacation",
        {
          "VACHR": 130
        }
      ],
      [
        "Assets:US:Vanguard:Cash",
        {
          "USD": 0.04
        }
      ],
      [
        "Assets:US:Vanguard:RGAGX",
        {
          "RGAGX": 103.322
        }
      ],
      [
        "Assets:US:Vanguard:VBMPX",
        {
          "VBMPX": 63.276
        }
      ],
      [
        "Equity:Opening-Balances",
        {
          "USD": -4363.280000000001
        }
      ],
      [
        "Expenses:Financial:Commissions",
        {
          "USD": 179
        }
      ],
      [
        "Expenses:Financial:Fees",
        {
          "USD": 48
        }
      ],
      [
        "Expenses:Food:Groceries",
        {
          "USD": 2196.8
        }
      ],
      [
        "Expenses:Food:Restaurant",
        {
          "USD": 3795.1800000000003
        }
      ],
      [
        "Expenses:Health:Dental:Insurance",
        {
          "USD": 75.4
        }
      ],
      [
        "Expenses:Health:Life:GroupTermLife",
        {
          "USD": 632.32
        }
      ],
      [
        "Expenses:Health:Medical:Insurance",
        {
          "USD": 711.88
        }
      ],
      [
        "Expenses:Health:Vision:Insurance",
        {
          "USD": 1099.8
        }
      ],
      [
        "Expenses:Home:Electricity",
        {
          "USD": 715
        }
      ],
      [
        "Expenses:Home:Internet",
        {
          "USD": 879.86
        }
      ],
      [
        "Expenses:Home:Phone",
        {
          "USD": 666.23
        }
      ],
      [
        "Expenses:Home:Rent",
        {
          "USD": 26400
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:CityNYC",
        {
          "USD": 4547.92
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Federal:PreTax401k",
        {
          "IRAUSD": 16500
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Federal",
        {
          "USD": 27635.920000000002
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:Medicare",
        {
          "USD": 2772.1200000000003
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:SDI",
        {
          "USD": 29.12
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:SocSec",
        {
          "USD": 7000.04
        }
      ],
      [
        "Expenses:Taxes:Y2010:US:State",
        {
          "USD": 9492.08
        }
      ],
      [
        "Expenses:Transport:Tram",
        {
          "USD": 1440
        }
      ],
      [
        "Income:US:ETrade:Dividends",
        {
          "USD": -70.55
        }
      ],
      [
        "Income:US:ETrade:Gains",
        {
          "USD": -76.05
        }
      ],
      [
        "Income:US:Federal:PreTax401k",
        {
          "IRAUSD": -16500
        }
      ],
      [
        "Income:US:Hoogle:GroupTermLife",
        {
          "USD": -632.32
        }
      ],
      [
        "Income:US:Hoogle:Match401k",
        {
          "USD": -8250
        }
      ],
      [
        "Income:US:Hoogle:Salary",
        {
          "USD": -119999.88
        }
      ],
      [
        "Income:US:Hoogle:Vacation",
        {
          "VACHR": -130
        }
      ],
      [
        "Liabilities:US:Chase:Slate",
        {
          "USD": -1144.44
        }
      ]
    ]
  },
  {
    "path": "t",
    "expected": "table",
    "actual": "error"
  },
  {
    "path": "types",
    "expected": [
      {
        "name": "account",
        "dtype": "str"
      },
      {
        "name": "sum((position))",
        "dtype": "inventory"
      }
    ]
  }
]
```

### journal (8)

#### `example/journals/journal__Assets.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "[66].narration",
    "expected": "",
    "actual": "EDISON POWER"
  },
  {
    "path": "[66].payee",
    "expected": "EDISON POWER",
    "actual": ""
  },
  {
    "path": "[74].narration",
    "expected": "",
    "actual": "Verizon Wireless"
  },
  {
    "path": "[74].payee",
    "expected": "Verizon Wireless",
    "actual": ""
  },
  {
    "path": "[75].narration",
    "expected": "",
    "actual": "Wine-Tarner Cable"
  },
  {
    "path": "[75].payee",
    "expected": "Wine-Tarner Cable",
    "actual": ""
  }
]
```

#### `example/journals/journal__Assets_US_BofA_Checking.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "[45].narration",
    "expected": "",
    "actual": "EDISON POWER"
  },
  {
    "path": "[45].payee",
    "expected": "EDISON POWER",
    "actual": ""
  },
  {
    "path": "[48].narration",
    "expected": "",
    "actual": "Verizon Wireless"
  },
  {
    "path": "[48].payee",
    "expected": "Verizon Wireless",
    "actual": ""
  },
  {
    "path": "[49].narration",
    "expected": "",
    "actual": "Wine-Tarner Cable"
  },
  {
    "path": "[49].payee",
    "expected": "Wine-Tarner Cable",
    "actual": ""
  }
]
```

#### `example/journals/journal__Expenses.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "[41].narration",
    "expected": "",
    "actual": "EDISON POWER"
  },
  {
    "path": "[41].payee",
    "expected": "EDISON POWER",
    "actual": ""
  },
  {
    "path": "[50].narration",
    "expected": "Eating out with Natasha",
    "actual": "Verizon Wireless"
  },
  {
    "path": "[50].payee",
    "expected": "Kin Soy",
    "actual": ""
  },
  {
    "path": "[50].postingAccounts[0]",
    "expected": "Expenses:Food:Restaurant",
    "actual": "Assets:US:BofA:Checking"
  },
  {
    "path": "[50].postingAccounts[1]",
    "expected": "Liabilities:US:Chase:Slate",
    "actual": "Expenses:Home:Phone"
  }
]
```

#### `example/journals/journal__Expenses_Food_Restaurant.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "[88].narration",
    "expected": "",
    "actual": "Mr. Marcel"
  },
  {
    "path": "[88].payee",
    "expected": "Mr. Marcel",
    "actual": ""
  },
  {
    "path": "[89].narration",
    "expected": "",
    "actual": "Chipotle"
  },
  {
    "path": "[89].payee",
    "expected": "Chipotle",
    "actual": ""
  },
  {
    "path": "[90].narration",
    "expected": "",
    "actual": "Dupar's"
  },
  {
    "path": "[90].payee",
    "expected": "Dupar's",
    "actual": ""
  }
]
```

#### `example/journals/journal__Liabilities.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 0)

Sample diffs:

```json
[
  {
    "path": "[166].narration",
    "expected": "",
    "actual": "Mr. Marcel"
  },
  {
    "path": "[166].payee",
    "expected": "Mr. Marcel",
    "actual": ""
  },
  {
    "path": "[167].narration",
    "expected": "",
    "actual": "Starbucks"
  },
  {
    "path": "[167].payee",
    "expected": "Starbucks",
    "actual": ""
  },
  {
    "path": "[168].narration",
    "expected": "",
    "actual": "Chipotle"
  },
  {
    "path": "[168].payee",
    "expected": "Chipotle",
    "actual": ""
  }
]
```

#### `query-example/journals/journal__Assets.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 4)

Sample diffs:

```json
[
  {
    "path": "[34].narration",
    "expected": "Employer match for contribution",
    "actual": "EDISON POWER"
  },
  {
    "path": "[34].postingAccounts[0]",
    "expected": "Assets:US:Vanguard:Cash",
    "actual": "Assets:US:BofA:Checking"
  },
  {
    "path": "[34].postingAccounts[1]",
    "expected": "Income:US:Hoogle:Match401k",
    "actual": "Expenses:Home:Electricity"
  },
  {
    "path": "[35].narration",
    "expected": "",
    "actual": "Employer match for contribution"
  },
  {
    "path": "[35].payee",
    "expected": "EDISON POWER",
    "actual": ""
  },
  {
    "path": "[35].postingAccounts[0]",
    "expected": "Assets:US:BofA:Checking",
    "actual": "Assets:US:Vanguard:Cash"
  }
]
```

#### `query-example/journals/journal__Assets_US_BofA_Checking.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 6)

Sample diffs:

```json
[
  {
    "path": "[20].narration",
    "expected": "",
    "actual": "EDISON POWER"
  },
  {
    "path": "[20].payee",
    "expected": "EDISON POWER",
    "actual": ""
  },
  {
    "path": "[22].narration",
    "expected": "",
    "actual": "Verizon Wireless"
  },
  {
    "path": "[22].payee",
    "expected": "Verizon Wireless",
    "actual": ""
  },
  {
    "path": "[23].narration",
    "expected": "Payroll",
    "actual": "Wine-Tarner Cable"
  },
  {
    "path": "[23].payee",
    "expected": "Hoogle",
    "actual": ""
  }
]
```

#### `query-example/journals/journal__Expenses.json`

- Likely layer: @beancount-js/beancount (loader/filter) or journal serialization
- Suggestion: Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 4)

Sample diffs:

```json
[
  {
    "path": "[28].narration",
    "expected": "",
    "actual": "EDISON POWER"
  },
  {
    "path": "[28].payee",
    "expected": "EDISON POWER",
    "actual": ""
  },
  {
    "path": "[33].narration",
    "expected": "",
    "actual": "Verizon Wireless"
  },
  {
    "path": "[33].payee",
    "expected": "Verizon Wireless",
    "actual": ""
  },
  {
    "path": "[34].narration",
    "expected": "Eating out with Joe",
    "actual": "Wine-Tarner Cable"
  },
  {
    "path": "[34].payee",
    "expected": "Chichipotle",
    "actual": ""
  }
]
```

### ledger_data (2)

#### `example/ledger_data.json`

- Likely layer: @beancount-js/beancount account discovery / open directives
- Suggestion: Reconcile account sets from open directives and implied accounts; Fava may include accounts only seen on postings.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "accountSet.length",
    "expected": 60,
    "actual": 91
  },
  {
    "path": "accountSet[0]",
    "expected": "Assets:US:BofA",
    "actual": "Assets"
  },
  {
    "path": "accountSet[1]",
    "expected": "Assets:US:BofA:Checking",
    "actual": "Assets:US"
  },
  {
    "path": "accountSet[2]",
    "expected": "Assets:US:ETrade:Cash",
    "actual": "Assets:US:BofA"
  },
  {
    "path": "accountSet[3]",
    "expected": "Assets:US:ETrade:GLD",
    "actual": "Assets:US:BofA:Checking"
  },
  {
    "path": "accountSet[4]",
    "expected": "Assets:US:ETrade:ITOT",
    "actual": "Assets:US:ETrade"
  }
]
```

#### `query-example/ledger_data.json`

- Likely layer: @beancount-js/beancount account discovery / open directives
- Suggestion: Reconcile account sets from open directives and implied accounts; Fava may include accounts only seen on postings.
- Diff stats: 40 paths (inventory-ish 0, date-ish 0, length 1)

Sample diffs:

```json
[
  {
    "path": "accountSet.length",
    "expected": 46,
    "actual": 73
  },
  {
    "path": "accountSet[0]",
    "expected": "Assets:US:BofA",
    "actual": "Assets"
  },
  {
    "path": "accountSet[1]",
    "expected": "Assets:US:BofA:Checking",
    "actual": "Assets:US"
  },
  {
    "path": "accountSet[2]",
    "expected": "Assets:US:ETrade:Cash",
    "actual": "Assets:US:BofA"
  },
  {
    "path": "accountSet[3]",
    "expected": "Assets:US:ETrade:GLD",
    "actual": "Assets:US:BofA:Checking"
  },
  {
    "path": "accountSet[4]",
    "expected": "Assets:US:ETrade:ITOT",
    "actual": "Assets:US:ETrade"
  }
]
```

## Passing cases

Total passing: 18.

- `example/accounts/account_report__Assets_US_Vanguard_RGAGX__balances__month__at_cost.json`
- `example/accounts/account_report__Assets_US_Vanguard_RGAGX__changes__month__at_cost.json`
- `example/journals/journal__Assets_US_ETrade_GLD.json`
- `example/journals/journal__Assets_US_Vanguard_RGAGX.json`
- `example/journals/journal__Equity.json`
- `example/journals/journal__Income.json`
- `example/queries/bofa-positions.json`
- `example/queries/select-account-sum-position.json`
- `example/queries/sum-number-currency.json`
- `query-example/journals/journal__Assets_US_ETrade_GLD.json`
- `query-example/journals/journal__Assets_US_Vanguard_RGAGX.json`
- `query-example/journals/journal__Equity.json`
- `query-example/journals/journal__Expenses_Food_Restaurant.json`
- `query-example/journals/journal__Income.json`
- `query-example/journals/journal__Liabilities.json`
- `query-example/queries/bofa-positions.json`
- `query-example/queries/select-account-sum-position.json`
- `query-example/queries/sum-number-currency.json`

## Known non-goals

- HTML account journals from `account_report` (journal mode)
- Chart aesthetics / ChartSwitcher ordering
- URL routing, sidebar, and filter UI chrome
- Balance sheet / income statement / holdings pages (unless pointed to by a query failure)
- Exact dtype label strings when normalized types already match

## Recommended follow-ups

1. Audit AT_VALUE / price conversion for GLD and Vanguard funds against Fava’s account_report as-of dates.
2. Align `LedgerData.dateRanges` / `intervalEnds` with Fava’s half-open intervals and first/last bounds so trailing extra periods disappear.
3. Implement or fix Beanquery `balances` shell command parity (`Invalid query stack(0)`).
4. Add beanquery fixtures for holdings-style GROUP BY and `SELECT account, sum(number), currency` against the shared example ledger.
5. Reconcile account-filtered journal membership (Open/Txn coverage) against Fava `/api/journal?account=`.
6. Decide whether intermediate parent accounts belong in the accounts list; match Fava’s leaf/open-oriented set for UI parity.
7. Regenerate with `tools/fava-parity/./run.sh` after each fix; use year/at_cost leaf accounts as the fast inner loop.

## How to regenerate

```bash
cd tools/fava-parity
./run.sh
```

