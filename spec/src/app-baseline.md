# Beancount Studio application baseline

Decision date: 28 October 2026.

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
reach into Fava, legacy UI, the forms compatibility facade, or private Design
Core source paths.

`packages/app` (`@beancount-js/app`) is the executable host for that UI. It owns
SvelteKit runtime configuration and the `BeancountDataSource` adapters; it does
not own application presentation. Server mode uses the repository filesystem
workspace behind same-origin project/file/resource endpoints. Web mode uses the
browser workspace and OPFS/local-directory capabilities directly.

Each controller owns its project and ledger selection, route/query history,
sidebar state and asynchronous requests. Data sources and clocks are injected.
Native filesystem access, API authorization, real bank/AI requests and durable
persistence belong to a host implementing `BeancountDataSource`. Keep
cancellation, errors and caches isolated to their owning controller/project.

## Current delivery surface

`pnpm dev` and `pnpm storybook` start the sole active catalog on localhost:6006.
`pnpm dev:app` starts the executable server host on localhost:5173, using
`BEANCOUNT_STUDIO_PROJECT_ROOT` and `BEANCOUNT_STUDIO_ENTRY_FILE` when supplied.
`pnpm build:app` produces the default server build; the host package also
qualifies explicit server and static web builds. Application stories compose
the shared shell with navigation, reports, editor, query/history, journal,
account activity, ingestion/settings and assistant. Standalone component
stories retain their catalog layout.

Storybook uses disposable in-memory projects and deterministic services. It
remains the UI development/review host. The executable host reads and writes
real ledger projects through revision-aware workspace adapters and exposes
referenced resources. Server mode also owns persisted ingestion configuration,
account discovery, connector-backed import runs, rule application, sync jobs
and their event streams. These routes use the repository server/connectors and
project-scoped secret references; successful fixture and route qualification
does not prove any external bank credential. Server mode also owns merchant
catalog/profile, brand matching, logo cache, merchant-review and reconciliation
routes, including revision-aware application to the ledger. It also owns the
persisted assistant sessions, streaming/approval endpoints and constrained
ledger MCP process used by the Codex provider. Route and MCP-handshake coverage
does not prove a real external provider turn. Static web mode deliberately
exposes only browser workspace capabilities. The deterministic Storybook
services remain intentionally limited.

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

## Retained compatibility and reference code

`packages/fava` remains an unchanged reference application. The selected visual
comparison commit is `498bd075266922ab11cb4358f19aa6b9828e8539`.
`UI_PROVENANCE.json` separately records the original adaptation source commit,
`215bb59f31d4658410c2fd2b0122022a56dff5aa`. Validate provenance against those
commits, rather than requiring deleted historical files in the current checkout.

`packages/fava-beta` retains the prior integration experiment and its backend
adapters. It is a legacy consumer, not the destination for a renewed extraction
campaign. Reuse useful repository-owned host services through the new controller
boundary when integrating the current application.

`packages/ui-legacy` retains the `@lapis/ui` production imports still required by
these hosts. `@beancount-js/forms` remains an implementation-free forwarding
facade for them. Neither is an active design system or catalog. Remove retained
runtime code only after its consumers have migrated or have been explicitly
retired. Do not add Storybook configuration, stories, new components or visual
capture tooling to the compatibility package.

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
- Dependency or compatibility changes also run `pnpm checks:compat` and the
  complete tests for affected hosts. Cross-package changes run the root test
  suite. Report existing failures separately; never suppress them to promote
  a baseline.
- Browser checks cover containment, keyboard/pointer actions, table geometry,
  pagination, controller isolation, themes and mobile layouts. These checks
  do not establish screenshot parity or human approval.
- Jujutsu and the pinned reference commit objects are prerequisites for catalog
  provenance checks. Keep the frozen Fava source and live reference ledger data
  out of test mutation/seed helpers.

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
