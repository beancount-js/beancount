# Beancount Studio application baseline

Decision date: 28 October 2026.

Legacy package retirement: 13 November 2026.

## Direction and ownership

The controller-backed application in `packages/ui` (`@beancount-js/ui`) is the
active UI baseline. It consumes published `@lapismd/design-core` shell, forms
and primitives. The former component-by-component extraction, native-CSS
certification ledger and Visual Delta catalog are superseded.

New work takes place in the main `beancount-js-studio` checkout, on the
`beancount-studio` development line. The historical
`beancount-js-studio-fava-pre-storybook` workspace remains available for history
and comparison; changes from it are integrated into this baseline.

`packages/ui/src/controller` owns typed actions, read-only reactive state,
navigation history and service lifetimes. `src/components` owns application
composition and reusable presentation. `src/domain` contains the adapted ledger
presentation, editors, charts and application bridges. These modules must not
reach into retired application source or private Design Core source paths.

`packages/app` (`@beancount-js/app`) is the executable host for that UI. It owns
SvelteKit runtime configuration and the `BeancountDataSource` adapters; it does
not own application presentation. Server mode uses the repository filesystem
workspace behind same-origin project/file/resource endpoints. Web mode uses the
browser workspace and OPFS/local-directory capabilities directly.

Each controller owns its project and ledger selection, route/query history,
sidebar state and asynchronous requests. Data sources and clocks are injected.
Native filesystem access, API authorization, real bank requests and durable
persistence belong to a host implementing `BeancountDataSource`. Keep
cancellation, errors and caches isolated to their owning controller/project.
The active host supplies no AI service. Its generic request adapter and optional
host-owned details snippet remain extension boundaries, not provider behavior.

## Current delivery surface

`pnpm dev` and `pnpm storybook` start the sole active catalog on localhost:6006.
The `beancount-studio` bookmark publishes that catalog to
`https://beancount-js.github.io/beancount-js-studio/` through GitHub Pages.
`pnpm dev:app` starts the executable server host on localhost:5173, using
`BEANCOUNT_STUDIO_PROJECT_ROOT` and `BEANCOUNT_STUDIO_ENTRY_FILE` when supplied.
`pnpm build:app` produces the default server build; the host package also
qualifies explicit server and static web builds. Application stories compose
the shared shell with navigation, reports, editor, query/history, journal,
account activity and ingestion/settings. Standalone component stories retain
their catalog layout.

Storybook uses disposable in-memory projects and deterministic services. It
remains the UI development/review host. The executable host reads and writes
real ledger projects through revision-aware workspace adapters and exposes
referenced resources. Server mode also owns persisted ingestion configuration,
account discovery, connector-backed import runs, rule application, sync jobs
and their event streams. These routes use the repository server/connectors and
project-scoped secret references; successful fixture and route qualification
does not prove any external bank credential. Server mode also owns merchant
catalog/profile, brand matching, logo cache, merchant-review and reconciliation
routes, including revision-aware application to the ledger. Static web mode
deliberately exposes only browser workspace capabilities. The deterministic
Storybook services remain intentionally limited.

The active delivery surface contains no AI component, provider route, MCP
process, ingestion enrichment endpoint or AI rule executor. The host strips
persisted AI source flags and excludes provider-backed rules before execution,
so older project configuration cannot reactivate those paths. Provider-neutral
executor contracts in shared accounting/server packages are dormant extension
hooks; reconnecting one requires an explicit future application integration.

Use public package exports and Design Core controller semantics. Reuse the
account appearance store, controller-scoped merchant-logo cache and shared
avatar renderer, including inside mounted CodeMirror widgets. Retain editor
context, native pointer/keyboard behavior and undo when adapting widgets.
The shared renderer composes the public Design Core Avatar, and account
appearance editing composes the public AvatarPicker. Preserve stored Lucide
icon names as legacy display input; new edits persist the picker's portable
image/emoji value and its separately selected colour. Searchable account
pickers use the same portable fallback identity when their public option
contract accepts an image rather than a component renderer.

## Retired applications and recorded provenance

`packages/fava`, `packages/fava-beta`, `packages/ui-legacy` and `packages/forms`
were retired after the active CLI, fixtures and form contract moved to
`packages/app` / `packages/ui`. The live parity harness was retired with them.
Do not restore these packages or add a second application/catalog path; recover
historical implementation only from Jujutsu history when a specific comparison
requires it.

The selected comparison commit remains
`498bd075266922ab11cb4358f19aa6b9828e8539`. `UI_PROVENANCE.json` separately
records the original adaptation source commit,
`215bb59f31d4658410c2fd2b0122022a56dff5aa`. Paths in provenance and catalog
inventories refer to those recorded commits and do not imply that a live Fava
source tree belongs in the current checkout. Active fixture snapshots are owned
by `packages/ui/catalog/fixtures/reference` and the form behavior contract is
`packages/ui/FORMS.md`.

## Validation contract

- Run `pnpm check:baseline` for package ownership, catalog and singleton-runtime
  configuration checks.
- Run `pnpm --filter @beancount-js/app checks` for host formatting, types,
  adapter/service tests, both production builds and the static OPFS
  save-and-reload browser acceptance.
- Every UI slice runs `pnpm checks:ui`, including formatting, boundaries,
  pinned-source/catalog validation, types, unit tests, browser/accessibility
  stories and the production catalog build. Verify built inventory with
  `pnpm --filter @beancount-js/ui exec node scripts/check-catalog.mjs --built`.
- Cross-package and dependency changes run `pnpm checks` and the root test
  suite. Report existing failures separately; never suppress them to promote a
  baseline.
- Browser checks cover containment, keyboard/pointer actions, table geometry,
  pagination, controller isolation, themes and mobile layouts. These checks
  do not establish screenshot parity or human approval.
- Jujutsu and the pinned reference commit objects are prerequisites for catalog
  provenance checks. Keep historical reference source out of the current
  package graph and keep reference ledger snapshots out of mutation/seed
  helpers.

## Preservation and recovery

`archive/pre-design-core-baseline-2026-10-28` preserves the complete previous
checkout at `96936679`, including the pending Visual Delta/macOS changes.
The baseline merge retains both that history and the Design Core UI history
through `316c911c`. Bookmarks are local unless explicitly published.

Inspect the previous state with:

```sh
jj --no-pager show archive/pre-design-core-baseline-2026-10-28
```

Create a separate review workspace from that bookmark when recovery is needed;
do not reset the active checkout or resume the superseded migration tracker.
