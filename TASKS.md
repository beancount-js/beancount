# Migration Tasks

Tracking obsidian-ledger → beancount-js migration progress.

Source repo: `/Users/stevejuma/code/obsidian-ledger`

## Done

- [x] Core packages migrated (`beancount`, `parser`, `filters`, `codemirror-lang-beancount`)
- [x] Phase 0 — pnpm, pinned deps, turborepo
- [x] Active UI shell: `Dashboard.svelte` + `context.ts` + store-based router
- [x] Search filter bar wired in Dashboard
- [x] Dynamic sidebar: errors badge, account picker, saved-query combobox
- [x] All report routes registered in `Main.svelte`
- [x] Charts infrastructure + ChartSwitcher on financial statements
- [x] Query stack (Query, QueryTable, QueryBox) + BQL engine in beancount
- [x] AccountDetails, Holdings, Statistics views
- [x] Journal grid + EditorDialog
- [x] Import pipeline: ingest backend, ImportTable/ImportEditor, file picker, routes
- [x] Removed unused Svelte 5 LedgerState shell (`ledger.svelte.ts`, `router.svelte.ts`, shadcn sidebar)
- [x] Root README.md
- [x] jj colocated with git

## Phase 0 — Tooling

- [x] Create TASKS.md migration tracker
- [x] Migrate npm workspaces → pnpm
- [x] Update and pin dependencies across all packages
- [x] Wire turborepo pipeline tasks

## Phase 1 — Shell & filters

- [x] Port Search filter bar (Dashboard header)
- [x] Dynamic sidebar: errors badge, account picker, saved-query combobox
- [x] Register routes for Holdings, Statistics, Query, AccountDetails

## Phase 2 — Charts

- [x] Port `charts/` directory from obsidian-ledger
- [x] Chart stores (Svelte writable stores in `stores/chart.ts`)
- [x] Add ChartSwitcher to IncomeStatement, BalanceSheet, TrialBalance

## Phase 3 — Report views

- [x] Port Query, QueryTable, QueryBox
- [x] Port AccountDetails, AccountTable, IntervalTreeTable
- [x] Port Holdings, Statistics views
- [x] Register all routes in Main.svelte

## Phase 4 — Journal grid

- [x] Port `grid/` (Root, Cell, types)
- [x] Port EditorDialog
- [x] JournalTable uses full grid implementation

## Phase 5 — Import pipeline

- [x] Port `ingest/` module in beancount
- [x] Port import schema/models/store (no Obsidian deps)
- [x] Standalone file picker (CSV + YAML/JSON config)
- [x] Port ImportTable, ImportEditor views
- [x] Routes: `/records`, `/import/editor`, `/directives`

## Phase 6 — Legacy cleanup

- [x] Remove App.svelte, unused LedgerState shell, shadcn sidebar duplicates
- [x] Remove dead `router.svelte.ts` and `journal-table/JournalTable.svelte`
- [x] Add root README.md
- [x] Basic fava helper smoke tests

---

## Gap matrix (current)

| Feature | obsidian route | beancount-js status |
|---------|----------------|---------------------|
| Editor | `/editor` | Done |
| Errors | `/errors` | Done (sidebar badge when errors exist) |
| Journal | `/journal` | Done — grid + EditorDialog |
| Income / Balance / Trial | reports | Done — tree tables + charts |
| Holdings | `/holdings` | Done |
| Statistics | `/statistics` | Done |
| Query (BQL) | `/query` | Done |
| Accounts | `/accounts`, `/account/:account` | Done |
| Search filter bar | all reports | Done (Dashboard) |
| Import records | `/records` | Done |
| Import config editor | `/import/editor` | Done |
| Generated directives | `/directives` | Done |
| ingest/categorizer | backend | Done (in beancount package) |
