# Application status

Updated: 12 November 2026.

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

`@beancount-js/app` is now the executable active host. `pnpm dev:app` mounts the
same public application/controller exports with either the server filesystem
API or the browser workspace. The server host reads and writes revision-aware
ledger files and serves referenced resources; the static web host uses OPFS or
a user-selected local directory. Neither host imports legacy Fava UI source.

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
| Application host adapters, persistence and service routes  | Passed: 37 tests                                                                              |
| Application server and static-web production builds        | Passed                                                                                        |
| Populated executable-host browser smoke                    | Passed: repository `sample.beancount` dashboard and editor loaded                             |
| Static web OPFS persistence                                | Passed: edit, save, direct storage read and full reload                                       |
| Populated server service smoke                             | Passed: assistant, ingestion config, merchant catalog and reconciliation summary routes       |
| Ledger assistant MCP runtime                               | Passed: initialization and five-tool inventory handshake                                      |
| Compatibility UI and forms facade                          | Passed: 69 tests and 22 forwarders                                                            |
| Retained Fava tests                                        | Passed: 188 tests                                                                             |
| Retained Fava Beta tests                                   | 188 of 189 passed in the concurrent root run; the failing editor DOM test passed in isolation |
| Complete root tests (`pnpm test`)                          | Forecast is fixed; aggregate remains non-green because of the retained Fava Beta test above   |

The forecast recurrence engine now anchors parsed RFC and natural-language
rules to the source transaction date, excludes the source transaction from
generated entries and includes the configured end date. Its package suite
passes 283 tests, including deterministic dates and flags for the previously
failing mixed-rule case.

The latest concurrent root run instead failed the retained Fava Beta CodeMirror
fold-gutter test `classifies metadata and updates its active state`. The
identical Fava test passed in that run, and the Fava Beta test passed immediately
when rerun in isolation. An earlier concurrent run produced the inverse result:
Fava failed while its Fava Beta twin passed, followed by a passing isolated
rerun. This is recorded as a concurrency-sensitive aggregate-gate failure
rather than promoted to a passing root result. No test was disabled or assertion
weakened.

## Remaining work and limits

- Qualify live bank and AI provider calls in the executable host. Its
  project/file/resource, ingestion, rules, streamed sync, merchant,
  reconciliation and assistant endpoints are integrated. The constrained ledger
  MCP process completed its initialization/tool-inventory handshake. No external
  bank credential or complete Codex provider turn has been exercised in this
  checkout, so route/fixture coverage does not prove those external systems.
- Human side-by-side visual signoff is not implied by automated geometry and
  accessibility checks. No new screenshot baseline, Docker or Visual Delta
  workflow is introduced by this transition.

The [baseline specification](../spec/src/app-baseline.md) and
[UI package README](../packages/ui/README.md) define the current direction.
