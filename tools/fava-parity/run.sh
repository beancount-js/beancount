#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"

cd "$ROOT"

echo "==> Capturing upstream Fava JSON"
python3 "$ROOT/capture-fava.py"

echo "==> Ensuring parser grammar package is built"
cd "$REPO_ROOT"
pnpm --filter @beancount-js/codemirror-lang-beancount build >/dev/null

echo "==> Capturing JS LedgerData / runBql payloads"
cd "$REPO_ROOT/packages/fava"
node ./scripts/run-fava-parity-capture.mjs

echo "==> Comparing and writing REPORT.md"
node "$ROOT/compare.mjs"

echo "Done. See $ROOT/REPORT.md"
