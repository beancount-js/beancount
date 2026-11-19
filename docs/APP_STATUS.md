# Application status

Updated: 19 November 2026.

## Current baseline

The canonical product requirements are the `BC-*` chapters in
[`spec/src`](../spec/src/index.md), with implementation status and concrete
evidence in [Verification](../spec/src/verification.md). This page is a dated
qualification report, not a second normative contract.

`packages/ui` (`@beancount-js/ui`) is the sole application UI and Storybook
catalog. It uses published Design Core 0.4.0 for the shell, forms, Avatar and
AvatarPicker. `packages/app` (`@beancount-js/app`) is the sole executable host;
it mounts the same public application/controller exports with server filesystem
or browser-workspace data sources.

The public review catalog is deployed from the `beancount-studio` bookmark to
[GitHub Pages](https://beancount-js.github.io/beancount/). Its
workflow builds and publishes the same `packages/ui` Storybook used locally.
The catalog exposes the canonical application specification as a first-class
Specification section rather than copying its normative text into Storybook.
All 15 catalog families have attached MDX Docs pages, and the public component
reference covers every component exported from `@beancount-js/ui`.

The server host reads and writes revision-aware ledger files, serves referenced
resources and owns persisted ingestion, connector, merchant, rule and
reconciliation routes. Static web mode uses OPFS or a user-selected local
directory. Storybook uses disposable, deterministic in-memory projects and
does not contact banks or mutate user ledgers.

The active app contains no AI panel, provider route, MCP process, ingestion
enrichment action or AI rule executor. Older persisted source flags and
provider-backed rule actions are filtered at the host boundary. The optional
host-owned details snippet and provider-neutral `BeancountDataSource.request`
boundary remain available for a future explicit integration.

## Validation observed for this baseline

| Lane                                                       | Result                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Baseline ownership                                         | Passed: one active UI and host                                                              |
| Frozen dependency installation                             | Passed                                                                                     |
| Current package checks                                     | Passed: all 14 non-UI workspace packages                                                   |
| UI formatting, dependency boundaries and catalog inventory | Passed: 24 routes, 8 navigation states, 9 table families and 29 public Design Core imports |
| UI type checking                                           | Passed: zero errors/warnings                                                               |
| UI unit tests                                              | Passed: 153 tests                                                                          |
| Storybook browser/accessibility                            | Passed: 72 tests                                                                           |
| Production catalog build and built inventory               | Passed                                                                                     |
| Application host adapters, persistence and service routes  | Passed: 31 tests                                                                           |
| Application server and static-web production builds        | Passed                                                                                     |
| Static web OPFS persistence                                | Passed: edit, save, direct storage read and full reload                                    |
| CLI active-host smoke                                      | Passed: root and `/api/projects` served by `packages/app`                                  |
| Complete root tests (`pnpm test`)                          | Passed: 21 of 21 tasks                                                                     |

The merchant-sheet catalog story now closes its portal before the next story.
This preserves modal pointer isolation in aggregate browser runs without
weakening any interaction or accessibility assertion.

## Remaining work and limits

- Qualify live bank calls in the executable host. Project/file/resource,
  ingestion, rules, streamed sync, merchant and reconciliation endpoints are
  integrated, but no external bank credential has been exercised in this
  checkout.
- AI remains intentionally outside the delivery surface. Reconnecting a shared
  executor contract requires a future, explicit host-owned integration.
- Automated geometry, behavior and accessibility checks do not establish human
  side-by-side visual approval. No screenshot, Docker or Visual Delta workflow
  is implied by this baseline.

The [baseline specification](../spec/src/app-baseline.md) and
[UI package README](../packages/ui/README.md) define the current direction.
