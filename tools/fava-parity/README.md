# Fava report output parity harness

Compares **upstream Fava JSON API** report payloads with the JS Studio computation path (`LedgerData` + `runBql`) on the same shared ledgers.

## Prerequisites

- `fava` on `PATH` (tested with 1.30.x)
- Sibling clone at `../../fava-upstream` (see `config.json`)
- Workspace deps installed (`pnpm install` at repo root)

## Run

```bash
./run.sh
```

Outputs:

- `out/fava/` — oracle captures
- `out/js/` — JS captures
- `out/normalized/` — normalized expected/actual pairs
- `out/summary.json` — machine-readable results
- `REPORT.md` — human disparity report

## Scope

Accounts (balances/changes trees + structured journals) and BQL queries. HTML journal markup and visual chrome are intentionally excluded.
