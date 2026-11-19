# Verification

Statuses describe the current checkout. `Implemented` means the named behavior
has source and automated evidence; it does not imply human visual approval or
qualification of external credentials. Governance rows are updated as their
owning implementation slices land.

| ID          | Status      | Evidence                                                                                                                                                          |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BC-ARCH-001 | Implemented | `scripts/check-app-baseline.mjs`, `packages/ui/scripts/check-boundaries.mjs`, and package checks enforce the active UI/host/domain ownership.                     |
| BC-ARCH-002 | Implemented | `packages/ui/src/controller` and controller/catalog tests cover injected services, navigation, cancellation, cache, and instance isolation.                       |
| BC-ARCH-003 | Implemented | Baseline checks reject retired packages and active AI paths; host rule and persistence tests cover filtering of older configuration.                              |
| BC-LANG-001 | Implemented | `packages/beancount/src/parity`, parser specs, booking specs, and oracle fixtures pin and test upstream commit `a3cb3fd9f946d6213dd350fb87709a8ef198301d`.        |
| BC-LANG-002 | Implemented | Parser and printer specs cover lowercase Boolean input and canonical output for Booleans and booking methods.                                                     |
| BC-LANG-003 | Implemented | Parser grammar/specs and CodeMirror language specs cover fenced bodies and retained non-directive Markdown.                                                       |
| BC-LANG-004 | Implemented | Option projection source/specs cover `fava-option`, `dashboard_collapsed`, `incognito`, and plugin defaults.                                                      |
| BC-LANG-005 | Implemented | `packages/beancount/src/parser/loader.spec.ts` and plugin specs cover precedence, YAML/legacy shapes, and unsupported configuration.                              |
| BC-CORE-001 | Implemented | Beancount loader, workspace adapters, and loader/workspace specs cover includes, typed results, modes, and diagnostics.                                           |
| BC-CORE-002 | Implemented | `packages/beancount/src/core`, `ops`, and `parser` specs cover booking, interpolation, balance/pad, realization, prices, and inventory.                           |
| BC-CORE-003 | Implemented | Loader and plugin specs cover plugin stages, ordering, unsupported plugins, and diagnostic failures.                                                              |
| BC-CORE-004 | Implemented | Filters and BeanQuery parser/query/source test suites plus UI report stories cover active query and report projections.                                           |
| BC-APP-001  | Implemented | Application catalog stories and controller unit tests cover active navigation, history, sidebar, mobile behavior, and controller isolation.                       |
| BC-APP-002  | Implemented | Editor unit/story tests and app persistence acceptance cover syntax, diagnostics, save, revision conflicts, undo, and full reload.                                |
| BC-APP-003  | Implemented | Table/report stories and browser tests cover sorting, filtering, pagination, interactions, accessibility, and geometry.                                           |
| BC-APP-004  | Implemented | Shared form components, form stories, `packages/ui/scripts/check-catalog.mjs`, and browser tests cover layout, picker, disclosure, and account identity behavior. |
| BC-APP-005  | Implemented | Catalog browser tests cover loading/error states, cancellation, themes, focus, overlays, containment, and mobile layouts.                                         |
| BC-ING-001  | Implemented | Connector packages, server routes, fixture tests, and app service tests cover host-owned Monzo, Starling, and Lunch Flow integration boundaries.                  |
| BC-ING-002  | Implemented | Server ingestion/sync services and tests cover project scoping, events, previews, checkpoints, and duplicate prevention.                                          |
| BC-ING-003  | Implemented | Server merchant services, controller cache tests, and merchant catalog stories cover profiles, matching, logo caching, and review.                                |
| BC-ING-004  | Implemented | Rule engine and server route tests cover ordered preview/apply, invalid actions, and exclusion of provider-backed rules.                                          |
| BC-ING-005  | Implemented | Reconciliation services, routes, and UI stories cover candidate states, decisions, revision conflicts, and ledger application.                                    |
| BC-HOST-001 | Implemented | `BeancountDataSource` contracts, adapters, and controller tests cover injected file/resource/request capabilities and isolation.                                  |
| BC-HOST-002 | Implemented | `packages/app` server adapter/route tests and CLI smoke checks cover repository projects, resources, services, and builds.                                        |
| BC-HOST-003 | Implemented | Static web build and OPFS browser acceptance cover edit, save, direct storage read, and full reload without server routes.                                        |
| BC-HOST-004 | Implemented | Baseline, package, app server/static, CLI, and production Storybook build checks cover the active delivery graph.                                                 |
| BC-CAT-001  | Implemented | UI catalog scripts and stories enforce one catalog with in-memory projects and immutable reference fixtures.                                                      |
| BC-CAT-002  | In progress | Preview already imports public Design Core Storybook and Lapis theme styles; shared manager and TOC behavior are not yet installed.                               |
| BC-CAT-003  | In progress | The application-baseline raw Markdown mirror exists; the full ordered `SUMMARY.md` mirror set is not yet present.                                                 |
| BC-CAT-004  | Implemented | UI checks run catalog inventory, unit, Storybook interaction/accessibility, and production build checks without screenshot baselines.                             |
| BC-GOV-001  | Planned     | Canonical chapters and verification are being introduced in this change; automated conformance is not yet wired.                                                  |
| BC-GOV-002  | Planned     | mdBook, QMD, scripts, and spec-validator configuration are scheduled for the tooling slice.                                                                       |
| BC-GOV-003  | Planned     | Mapped spec-first protection is scheduled for the tooling and agent-guidance slices.                                                                              |
| BC-GOV-004  | Planned     | Root governance and functional check composition is scheduled for the tooling slice.                                                                              |
| BC-GOV-005  | Planned     | Named CI jobs and branch protection are scheduled after local implementation is verified.                                                                         |
