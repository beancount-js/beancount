# Design-system renderer audit

This audit records the visual source that has been copied into
`@beancount-js/ui` before any application import is changed. A UI component
accepts display-ready models and callbacks; it must not read a Fava store,
route, server API, ledger object, or formatter context.

## Canonical UI copies

| Surface                  | UI source                                                                     | Fava ownership during this stage                                                      |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| shadcn-svelte families   | `src/components/shadcn`                                                       | Original editable Fava source remains until consumer migration.                       |
| shared forms and editors | `src/components/forms`                                                        | Fava continues to import `@beancount-js/forms` until the forms migration.             |
| app frame and navigation | `AppShell.svelte`, `layout/*`, `navigation/*`                                 | Studio-specific project, router, and storage behaviour stays in Fava adapters.        |
| Studio shell header      | `layout/StudioShellHeader.svelte`                                             | Fava continues to bind workspace settings and responsive sidebar state.               |
| ordinary typed tables    | `tables/DataTable.svelte`                                                     | Applications provide their own columns and data.                                      |
| account hierarchy        | `tables/AccountTreeTable.svelte`                                              | Fava maps account-tree data and routes into its plain tree/callback model.            |
| ledger activity          | `tables/LedgerActivityTable.svelte`                                           | Fava continues to derive records, balances, and date groups from ledger data.         |
| query results            | `tables/QueryResultsTable.svelte`                                             | Fava continues to execute BQL and preformat values.                                   |
| account bulk actions     | `tables/AccountBulkActionSheet.svelte`                                        | Fava continues to calculate patches, confirm destructive actions, and persist files.  |
| ingestion review queue   | `tables/IngestionReviewTable.svelte`                                          | Fava continues to apply search, paginate, open review sheets, and mutate proposals.   |
| import account mapping   | `tables/ImportMappingTable.svelte`                                            | Fava continues to parse files, infer accounts, rewrite directives, and persist files. |
| validation feedback      | `feedback/ValidationErrorTable.svelte`                                        | Fava continues to normalize parser and validation errors.                             |
| loading/skeleton states  | `feedback/*Skeleton.svelte`                                                   | Route loading remains application orchestration.                                      |
| chart controls           | `charts/ChartLegend.svelte`, `ChartModeSwitch.svelte`, `ChartSwitcher.svelte` | Chart data/rendering remains a separate extraction below.                             |
| line and area charts     | `charts/LineChart.svelte`                                                     | Fava continues to derive time-series data and ledger-format values.                   |
| ledger event plot        | `charts/ScatterPlot.svelte`                                                   | Fava continues to derive event categories and routes.                                 |
| grouped and stacked bars | `charts/BarChart.svelte`                                                      | Fava continues to derive interval, budget, account-stack, and route data.             |

## Application adapters still to extract

These Fava components remain Storybook-visible only because they have no
independent UI copy yet. They are not allowed to become new cross-app
primitives in place; first extract a model-driven UI component, then migrate
the Fava adapter in a separate change.

- Chart rendering: Fava's `Chart` adapter, hierarchy renderer, and dashboard
  charts. The UI-owned `LineChart`, `ScatterPlot`, and `BarChart` accept display
  models; extract the remaining data/formatter/callback models without importing
  Fava chart or format stores.
- Review and import surfaces: `ImportTable`. The UI-owned
  `IngestionReviewTable` covers grouped queue presentation, selection, and row
  callbacks, while `ImportMappingTable` covers controlled account mapping. Fava
  still applies parsing, matching, source rewrites, upload, persistence, search,
  pagination, review sheets, and mutation APIs. `AccountBulkActionSheet`'s Fava
  adapter still owns patch calculation, confirmation, and saves.
- Workspace adapters: `StudioShell` and `FavaNavigation`. `AppShell` and
  `StudioShellHeader` are UI-owned; project selection, routing, local storage,
  responsive sidebar state, and server actions remain in the application.
- Domain pages: `JournalTable`, `QueryTable`, merchant/reconciliation flows,
  and dashboard containers. Compose the canonical UI tables and controls after
  their input models have been extracted.

## Completion rule for a copied visual surface

1. Add the prop-driven component, styles, Docs description, and interaction
   stories in `packages/ui/src/components`.
2. Cover error, empty, and meaningful interactive states in the component's
   Storybook tests and pass the catalog accessibility gate.
3. Remove only that component's direct Fava story from
   `.storybook/main.ts`; do not modify or delete the production Fava source.
4. Run `pnpm --filter @beancount-js/ui checks` and commit the copy before
   starting another surface.
5. Migrate Fava imports only after the visual model is manually approved. The
   adapter may then become a small data/route boundary rather than another
   component implementation.
