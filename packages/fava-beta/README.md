# Retained Fava Beta integration host

This package retains the previous integration experiment and its application
services. The active UI baseline is now
[`packages/ui`](../ui/README.md), using published Design Core and typed
application controllers. See the
[baseline specification](../../spec/src/app-baseline.md).

This host currently consumes the frozen `@lapis/ui` compatibility package at
`packages/ui-legacy`. New UI features and stories belong in the active package.
Reusable host services may be adapted to `BeancountDataSource` during production
host integration; retaining this package does not establish that integration.

Run `pnpm --filter @beancount-js/fava-beta test:run` for its unit suite.
Legacy filesystem tests must use disposable fixture projects, never the pinned
reference workspace or live comparison ledgers.
