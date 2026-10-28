# Active Beancount application UI

This package is the application baseline in the main checkout as of
28 October 2026. It supersedes the former extraction/native-CSS catalog.
See the [specification](../../spec/src/app-baseline.md),
[status](../../docs/APP_STATUS.md) and [agent guidance](AGENTS.md).
`packages/ui-legacy` retains compatibility imports for older hosts; new UI work
belongs here and consumes published Design Core.

Reusable Beancount application components backed by published Design Core 0.3.1. The original Fava application remains the comparison application.

Run `pnpm dev` or `pnpm storybook` from the repository root. This is the sole active catalog and binds to `127.0.0.1:6006`. Retained Fava hosts are separate legacy/reference surfaces. Stories own deterministic, disposable controller instances and do not access a server or browser storage.

Consumers import `BeancountApplication` from `@beancount-js/ui`, controllers from `@beancount-js/ui/controller`, and `@beancount-js/ui/styles.css` once. Hosts supply a `BeancountController` and dispose it when their application is destroyed; the application initializes it on mount. The application owns its Design Core shell controller.

Run `pnpm --filter @beancount-js/ui checks` for formatting, dependency boundaries, catalog coverage, types, unit tests, Storybook interactions/accessibility and the static build. `pnpm --filter @beancount-js/ui exec node scripts/check-catalog.mjs --built` also checks the built story index. Source provenance is recorded in `UI_PROVENANCE.json`; `CATALOG_INVENTORY.json` maps all 24 frozen reference routes to their adapted components and stories and lists the public Design Core imports.

The catalog includes reports, journal/account details, CodeMirror editing, query/search, resource viewing, ingestion/settings and the assistant. Additional stories cover loading, an empty workspace, retry after failure, dark dashboard/editor, project isolation and mobile shell navigation. The reference application chrome is replaced by the shared Design Core shell, navigation controls and forms; ledger-specific tables, charts and editors retain their copied presentation. Reference provenance is validated at the recorded historical commits; source under `packages/fava` remains unchanged by this transition.

Controller state is read-only and reactive; changes go through typed actions. Each instance owns presentation stores, navigation history, workspace selection and service lifetimes. Hosts inject the data source and clock. The catalog harness imports the package's public application and controller exports, so the browser stories and build also exercise the consumer entrypoints. Accessibility violations fail the browser gate automatically, including after each story's interaction sequence. These checks do not establish screenshot parity.

Ingestion stories use an isolated service adapter for source configuration, merchant profiles, rule previews/application, sync events and import acceptance. Accepting a fixture import writes balanced postings to the in-memory ledger with file revision protection; it never contacts a bank. API-backed presentation uses the host controller's request adapter. Import and settings state belongs to each controller instance.

External bank calls and live brand matching are represented by deterministic fixtures. Merchant backfill returns an unchanged snapshot, and reconciliation decisions currently update review state without writing a transfer to the ledger. Production hosts must provide those service implementations; catalog route coverage does not imply full backend coverage.

The assistant is composed in the Design Core right sidebar. Desktop and mobile controls use the shell controller, and editor selections open that panel. The catalog streams a deterministic title proposal through the same event parser used by production; keep performs a revision-aware file save, undo leaves the file unchanged, and clear resets the project chat. Hosts supply their own AI endpoint through `BeancountDataSource.request`.
