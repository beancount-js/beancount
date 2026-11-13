# Active Beancount application UI

This package is the application baseline in the main checkout as of
28 October 2026. It supersedes the former extraction/native-CSS catalog.
See the [specification](../../spec/src/app-baseline.md),
[status](../../docs/APP_STATUS.md) and [agent guidance](AGENTS.md).
New UI work belongs here and consumes published Design Core; the former
application and compatibility packages are retired.

Reusable Beancount application components backed by published Design Core 0.4.0. Historical Fava commits remain recorded comparison sources, not live packages.

Run `pnpm dev` or `pnpm storybook` from the repository root. This is the sole active catalog and binds to `127.0.0.1:6006`. Run `pnpm dev:app` for the sole executable `packages/app` host on `127.0.0.1:5173`. Stories own deterministic, disposable controller instances and do not access a server or browser storage; the executable host injects real filesystem/API or browser-workspace data sources.

The Application/Dashboard and matching-preview stories select the byte-identical
workspace-root `sample.beancount` snapshot recorded from Fava comparison commit
`498bd075`. Specialized review stories retain a separate synthetic project for
nested tags, multiple currencies, long values, scrolling and pagination.

Consumers import `BeancountApplication` from `@beancount-js/ui`, controllers from `@beancount-js/ui/controller`, and `@beancount-js/ui/styles.css` once. Hosts supply a `BeancountController` and dispose it when their application is destroyed; the application initializes it on mount. The application owns its Design Core shell controller.

Run `pnpm --filter @beancount-js/ui checks` for formatting, dependency boundaries, catalog coverage, types, unit tests, Storybook interactions/accessibility and the static build. `pnpm --filter @beancount-js/ui exec node scripts/check-catalog.mjs --built` also checks the built story index. Source provenance is recorded in `UI_PROVENANCE.json`; `CATALOG_INVENTORY.json` maps all 24 frozen reference routes to their adapted components and stories, 8 navigation states and 9 table families, and lists the public Design Core imports.

The catalog includes reports, journal/account details, CodeMirror editing, query/search, resource viewing and ingestion/settings. Additional stories cover loading, an empty workspace, retry after failure, dark dashboard/editor, project isolation and mobile shell navigation. The reference application chrome is replaced by the shared Design Core shell, navigation controls and forms; ledger-specific tables, charts and editors retain their adapted presentation. Reference provenance is validated at recorded historical commits without a live Fava package.

Account presentation is centralized through the public Design Core Avatar while
preserving Beancount account sizing, merchant-logo precedence and legacy Lucide
metadata. The appearance editor uses Design Core AvatarPicker for image/emoji
and colour selection. Searchable account options use a portable fallback avatar,
so account pickers in navigation, journal, rules and ingestion surfaces retain
the same identity cue. New appearance edits save the picker value and colour;
existing Lucide values remain display-compatible.

Controller state is read-only and reactive; changes go through typed actions. Each instance owns presentation stores, navigation history, workspace selection and service lifetimes. Hosts inject the data source and clock. The catalog harness imports the package's public application and controller exports, so the browser stories and build also exercise the consumer entrypoints. Accessibility violations fail the browser gate automatically, including after each story's interaction sequence. These checks do not establish screenshot parity.

Ingestion stories use an isolated service adapter for source configuration, merchant profiles, rule previews/application, sync events and import acceptance. Accepting a fixture import writes balanced postings to the in-memory ledger with file revision protection; it never contacts a bank. API-backed presentation uses the host controller's request adapter. Import and settings state belongs to each controller instance.

External bank calls and live brand matching are represented by deterministic fixtures in Storybook. Its merchant backfill returns an unchanged snapshot, and its reconciliation decisions update review state without writing a transfer to the ledger. The executable server host supplies the real connector, merchant and reconciliation routes, including revision-aware ledger application; catalog route coverage still does not imply external credential qualification.

The active application ships no AI surface. `BeancountApplication` retains an optional, host-owned details snippet and provider-neutral labels, while `BeancountDataSource.request` remains the generic service boundary. A future integration can supply a panel and service adapter without restoring provider code to the application package.
