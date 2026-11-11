# Application status

Updated: 11 November 2026.

## Baseline transition

The Design Core application catalog is the active UI in the main
`beancount-js-studio` checkout. The previous state is preserved at
`archive/pre-design-core-baseline-2026-10-28` (`96936679`), including the pending
Visual Delta work. The active UI originates from the historical workspace
through `316c911c`, including navigation/table parity repairs, editor typography,
shared sidebar controls and CodeMirror account avatars. The active package now
uses published Design Core 0.4.0, including its public Avatar and AvatarPicker.
Account appearance metadata accepts the retained Lucide icon names for existing
ledgers; new edits store the picker image/emoji value and colour. Account links,
CodeMirror widgets, ingestion/reconciliation surfaces and searchable account
pickers use the shared adapter or its portable picker image.

The active package is `@beancount-js/ui`. `pnpm dev` opens its Storybook catalog.
The older catalog, extraction runners, snapshots and Visual Delta configuration
have been removed from `packages/ui`. Required `@lapis/ui` production imports
are retained in `packages/ui-legacy`; that package has no Storybook setup.
Fava and Fava Beta remain legacy consumers. Fava source is unchanged.

## Validation observed during integration

| Lane                                                       | Result                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Baseline ownership/catalog guard                           | Passed                                                                                        |
| Frozen dependency installation                             | Passed with the Design Core 0.4.0 lockfile                                                    |
| UI formatting, dependency boundaries and catalog inventory | Passed: 24 routes, 8 navigation states, 9 table families and 32 public Design Core imports    |
| UI type checking                                           | Passed: zero errors/warnings                                                                  |
| UI unit tests                                              | Passed: 156 tests                                                                             |
| Storybook browser/accessibility                            | Passed: 75 tests in the latest full run                                                       |
| Production catalog build and built inventory               | Passed                                                                                        |
| Compatibility UI and forms facade                          | Passed: 69 tests and 22 forwarders                                                            |
| Retained Fava tests                                        | 187 of 188 passed in the concurrent root run; the failing editor DOM test passed in isolation |
| Retained Fava Beta tests                                   | Passed: 189 tests                                                                             |
| Complete root tests (`pnpm test`)                          | Forecast is fixed; aggregate remains non-green because of the retained Fava test above        |

The forecast recurrence engine now anchors parsed RFC and natural-language
rules to the source transaction date, excludes the source transaction from
generated entries and includes the configured end date. Its package suite
passes 283 tests, including deterministic dates and flags for the previously
failing mixed-rule case.

The latest concurrent root run instead failed the retained Fava CodeMirror
header test `hides ## markers when the cursor leaves the heading line`. The
identical Fava Beta test passed in that run, and the Fava test passed immediately
when rerun in isolation. This is recorded as an aggregate-gate failure rather
than promoted to a passing root result. No test was disabled or assertion
weakened.

## Remaining work and limits

- Integrate a production host through `BeancountDataSource`. Current application
  stories use disposable in-memory storage and fixture services.
- Qualify real filesystem/persistence, bank, merchant and AI services. Fixture
  coverage does not prove these integrations; reconciliation and merchant
  backfill limitations are recorded in the UI README.
- Human side-by-side visual signoff is not implied by automated geometry and
  accessibility checks. No new screenshot baseline, Docker or Visual Delta
  workflow is introduced by this transition.

The [baseline specification](../spec/src/app-baseline.md) and
[UI package README](../packages/ui/README.md) define the current direction.
