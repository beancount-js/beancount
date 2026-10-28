# Application status

Updated: 28 October 2026.

## Baseline transition

The Design Core application catalog is being promoted into the main
`beancount-js-studio` checkout. The previous state is preserved at
`archive/pre-design-core-baseline-2026-10-28` (`96936679`), including the pending
Visual Delta work. The active UI originates from the historical workspace
through `316c911c`, including navigation/table parity repairs, editor typography,
shared sidebar controls and CodeMirror account avatars.

The active package is `@beancount-js/ui`. `pnpm dev` opens its Storybook catalog.
The older catalog, extraction runners, snapshots and Visual Delta configuration
have been removed from `packages/ui`. Required `@lapis/ui` production imports
are retained in `packages/ui-legacy`; that package has no Storybook setup.
Fava and Fava Beta remain legacy consumers. Fava source is unchanged.

## Validation observed during integration

| Lane | Result |
| --- | --- |
| Baseline ownership/catalog guard | Passed |
| Frozen dependency installation | Passed before final singleton alignment; final verification pending |
| UI formatting, dependency boundaries and catalog inventory | Passed |
| UI type checking | Passed: zero errors/warnings |
| UI unit tests | Passed: 150 tests |
| Storybook browser/accessibility | Passed: 70 stories in the latest full run |
| Production catalog build and built inventory | Pending final integration run |
| Compatibility UI and forms facade | Passed: 69 tests and 22 forwarders |
| Retained Fava tests | Passed: 188 tests |
| Retained Fava Beta tests | Passed: 189 tests |
| Complete root tests (`turbo run test:run --continue=always`) | 22 of 23 tasks passed; forecast assertion below remains failing |

The root suite fails in
`packages/beancount/src/plugins/forecast.spec.ts`, test
`supports RFC and natural-language recurrence rules`: expected five entries,
received six. The engine source/test files are unchanged from the preserved
baseline. This is an outstanding accounting-engine test failure, not a passing
aggregate gate. No test was disabled or assertion weakened.

## Remaining work and limits

- Complete final build/install verification and move the `beancount-studio`
  bookmark to the qualified baseline commits.
- Resolve and qualify the forecast recurrence failure independently.
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
