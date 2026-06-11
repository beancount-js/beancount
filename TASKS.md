# Migration Tasks

Tracking obsidian-ledger → beancount-js migration progress.

Source repo: `/Users/stevejuma/code/obsidian-ledger`

## Done

- [x] Core packages migrated (`beancount`, `parser`, `filters`, `codemirror-lang-beancount`)
- [x] Svelte 5 shell with `Main.svelte` + `LedgerState` (runes)
- [x] Routes: `/editor`, `/errors`, `/journal`, `/income_statement`, `/balance_sheet`, `/trial_balance`
- [x] shadcn sidebar navigation
- [x] jj colocated with git

## In progress

- [ ] Phase 0 — Monorepo foundation

---

## Phase 0 — Tooling

- [x] Create TASKS.md migration tracker
- [x] Migrate npm workspaces → pnpm
- [ ] Update and pin dependencies across all packages
- [ ] Wire turborepo pipeline tasks

## Phase 1 — Shell & filters

- [ ] Port Search filter bar to Svelte 5 (wire into Main/sidebar)
- [ ] Dynamic sidebar: errors badge, account picker, saved-query combobox
- [ ] Register routes for Holdings, Statistics, Query, AccountDetails (stub components first)

## Phase 2 — Charts

- [ ] Port `charts/` directory from obsidian-ledger
- [ ] Convert chart stores to Svelte 5 runes
- [ ] Add ChartSwitcher to IncomeStatement, BalanceSheet, TrialBalance

## Phase 3 — Report views

- [ ] Port Query, QueryTable, QueryBox
- [ ] Port AccountDetails, AccountTable, IntervalTreeTable
- [ ] Port Holdings, Statistics views
- [ ] Register all routes in Main.svelte

## Phase 4 — Journal grid

- [ ] Port `grid/` (Root, Cell, types)
- [ ] Port EditorDialog
- [ ] Replace simplified JournalTable with full grid implementation

## Phase 5 — Import pipeline

- [ ] Port `ingest/` package (categorizer, classifiers)
- [ ] Port import schema/models (no Obsidian deps)
- [ ] Standalone file picker (CSV + YAML config)
- [ ] Port ImportTable, ImportEditor views
- [ ] Routes: `/records`, `/import/editor`, `/directives`

## Phase 6 — Legacy cleanup

- [ ] Remove App.svelte, Dashboard.svelte, Nav.svelte, context.ts
- [ ] Remove dead router/router.ts if superseded
- [ ] Migrate remaining Svelte 4 stores to runes
- [ ] Add root README.md
- [ ] Expand fava test coverage

---

## Gap matrix

| Feature | obsidian route | beancount-js status |
|---------|----------------|---------------------|
| Editor | `/editor` | Done |
| Errors | `/errors` | Done (sidebar badge pending) |
| Journal | `/journal` | Degraded — DataTable only |
| Income / Balance / Trial | reports | Degraded — no charts |
| Holdings | `/holdings` | Menu only → NotFound |
| Statistics | `/statistics` | Menu only → NotFound |
| Query (BQL) | `/query` | Missing |
| Accounts | `/accounts`, `/account/:account` | Missing |
| Search filter bar | all reports | Exists, not wired |
| Import records | `/records` | Missing |
| Import config editor | import mode | Missing |
| Generated directives | `/directives` | Missing |
| ingest/categorizer | backend | Missing |
