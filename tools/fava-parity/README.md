# Fava report output parity harness

Compares **upstream Fava JSON API** report payloads with the JS Studio computation path (`LedgerData` + `runBql` / Tree) on the same shared ledgers.

## Prerequisites

- `fava` on `PATH` (tested with 1.30.x)
- Sibling clone at `../../fava-upstream` (see `config.json`)
- Workspace deps installed (`pnpm install` at repo root)

## Run

From repo root:

```bash
pnpm fava-parity
```

Or:

```bash
cd tools/fava-parity && ./run.sh
```

Outputs:

- `out/fava/` — oracle captures
- `out/js/` — JS captures
- `out/normalized/` — normalized expected/actual pairs
- `out/summary.json` — machine-readable results
- `REPORT.md` — human disparity report

## Scope

API-comparable report payloads:

| Kind | Source |
|---|---|
| `account_report` | trees + **budgets** (`balances` / `changes`) |
| `journal` | structured journal JSON |
| `query` | BQL including holdings + statistics tabs |
| `ledger_data` | accounts list |
| `income_statement` / `balance_sheet` / `trial_balance` | trees only (charts omitted) |
| `statistics` | balances, entries_by_type, balance directives |
| `commodities` / `events` / `options` / `errors` | report JSON |

Ledgers: upstream `example.beancount`, `query-example.beancount`, and repo-root `sample-budgets.beancount` (budget coverage).

## Non-goals

- HTML journals, chart aesthetics, editor/documents FS, Import/Help
- Studio-only routes (`/dashboard`, `/import/*`, `/records`)
- Merging this **fava-parity** workspace tip into **studio** unless explicitly requested
