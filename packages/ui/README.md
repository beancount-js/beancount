# Beancount application UI

`@beancount-js/ui` is the product's sole application UI and Storybook catalog.
It provides reusable Beancount application components backed by published
Design Core 0.4.0. See the
[specification](../../spec/src/app-baseline.md),
[status](../../docs/APP_STATUS.md), and [agent guidance](AGENTS.md).

Run `pnpm dev` or `pnpm storybook` from the repository root. The catalog binds
to `127.0.0.1:6006`. Run `pnpm dev:app` for the executable `packages/app` host
on `127.0.0.1:5173`. Stories own deterministic, disposable controller instances
and do not access a server or browser storage; the executable host injects real
filesystem/API or browser-workspace data sources.

Application stories use catalog-owned fixture ledgers. Specialized review
stories use a separate synthetic project for nested tags, multiple currencies,
long values, scrolling, and pagination. All fixture data is deterministic and
disposable.

Consumers import `BeancountApplication` from `@beancount-js/ui`, controllers
from `@beancount-js/ui/controller`, and `@beancount-js/ui/styles.css` once.
Hosts supply a `BeancountController` and dispose it when their application is
destroyed; the application initializes it on mount. The application owns its
Design Core shell controller.

Run `pnpm --filter @beancount-js/ui checks` for formatting, dependency
boundaries, catalog coverage, types, unit tests, Storybook
interactions/accessibility, and the static build. `pnpm --filter
@beancount-js/ui exec node scripts/check-catalog.mjs --built` also checks the
built story index. `CATALOG_INVENTORY.json` records the 24 application routes,
8 navigation states, 9 table families, and public Design Core imports covered
by the catalog.

The catalog includes reports, journal/account details, CodeMirror editing,
query/search, resource viewing, and ingestion/settings. Additional stories
cover loading, an empty workspace, retry after failure, dark dashboard/editor,
project isolation, and mobile shell navigation. The application uses the
shared Design Core shell, navigation controls, and forms alongside its
ledger-specific tables, charts, and editors.

Account presentation is centralized through the public Design Core Avatar
while preserving Beancount account sizing, merchant-logo precedence, and
Lucide metadata. The appearance editor uses Design Core AvatarPicker for
image/emoji and colour selection. Searchable account options use a portable
fallback avatar, so account pickers in navigation, journal, rules, and
ingestion surfaces retain the same identity cue.

Controller state is read-only and reactive; changes go through typed actions.
Each instance owns presentation stores, navigation history, workspace
selection, and service lifetimes. Hosts inject the data source and clock. The
catalog harness imports the package's public application and controller
exports, so browser stories and builds exercise the consumer entrypoints.
Accessibility violations fail the browser gate after each story's interaction
sequence. These checks do not establish human visual approval.

Ingestion stories use an isolated service adapter for source configuration,
merchant profiles, rule previews/application, sync events, and import
acceptance. Accepting a fixture import writes balanced postings to the
in-memory ledger with file revision protection; it never contacts a bank.
API-backed presentation uses the host controller's request adapter. Import and
settings state belongs to each controller instance.

External bank calls and live brand matching are represented by deterministic
fixtures in Storybook. Merchant backfill returns an unchanged snapshot, and
reconciliation decisions update review state without writing a transfer to the
ledger. The executable server host supplies the real connector, merchant, and
reconciliation routes, including revision-aware ledger application; catalog
route coverage does not imply external credential qualification.

The active application ships no AI surface. `BeancountApplication` retains an
optional, host-owned details snippet and provider-neutral labels, while
`BeancountDataSource.request` remains the generic service boundary. A future
integration can supply a panel and service adapter through those explicit host
boundaries.
