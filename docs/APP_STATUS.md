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

| Lane                                                       | Result                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Baseline ownership/catalog guard                           | Passed                                                                                     |
| Frozen dependency installation                             | Passed with the Design Core 0.4.0 lockfile                                                 |
| UI formatting, dependency boundaries and catalog inventory | Passed: 24 routes, 8 navigation states, 9 table families and 29 public Design Core imports |
| UI type checking                                           | Passed: zero errors/warnings                                                               |
| UI unit tests                                              | Passed: 151 tests                                                                          |
| Storybook browser/accessibility                            | Passed: 72 tests in the latest full run                                                    |
| Production catalog build and built inventory               | Passed                                                                                     |
| Application host adapters, persistence and service routes  | Passed: 31 tests                                                                           |
| Application server and static-web production builds        | Passed                                                                                     |
| Populated executable-host browser smoke                    | Passed: repository `sample.beancount` dashboard and editor loaded                          |
| Static web OPFS persistence                                | Passed: edit, save, direct storage read and full reload                                    |
| Populated server service smoke                             | Passed: ingestion config, merchant catalog and reconciliation summary routes               |
| Application AI removal policy                              | Passed: no panel, provider route, MCP process, enrichment action or rule executor          |
| Compatibility UI and forms facade                          | Passed: 69 tests and 22 forwarders                                                         |
| Retained Fava tests                                        | Passed: 188 tests                                                                          |
| Retained Fava Beta tests                                   | Passed: 189 tests                                                                          |
| Complete root tests (`pnpm test`)                          | Passed: 24 of 24 tasks                                                                     |

The forecast recurrence engine now anchors parsed RFC and natural-language
rules to the source transaction date, excludes the source transaction from
generated entries and includes the configured end date. Its package suite
passes 283 tests, including deterministic dates and flags for the previously
failing mixed-rule case.

The final concurrent root run passed all 24 tasks. It included the retained Fava
suite at 188 tests and Fava Beta at 189 tests; both mirrored CodeMirror
fold-gutter tests passed in the aggregate. Earlier concurrent runs had produced
opposite one-off failures between those twins followed by passing isolated
reruns, so the history remains relevant when diagnosing future intermittent
failures. No test was disabled or assertion weakened.

## Remaining work and limits

- Qualify live bank calls in the executable host. Its project/file/resource,
  ingestion, rules, streamed sync, merchant and reconciliation endpoints are
  integrated. No external bank credential has been exercised in this checkout,
  so route/fixture coverage does not prove that external system.
- AI is intentionally outside the active delivery surface. Existing persisted
  source flags and provider-backed rule actions are filtered at the host
  boundary, so they cannot reactivate execution. The application retains only
  the optional host-owned details snippet and provider-neutral request boundary
  for a future, explicitly integrated service.
- Human side-by-side visual signoff is not implied by automated geometry and
  accessibility checks. No new screenshot baseline, Docker or Visual Delta
  workflow is introduced by this transition.

The [baseline specification](../spec/src/app-baseline.md) and
[UI package README](../packages/ui/README.md) define the current direction.
