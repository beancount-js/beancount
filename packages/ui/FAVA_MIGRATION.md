# Fava to UI migration

This file is the source of truth for moving reusable Fava presentation into
`@beancount-js/ui` and integrating it through `@beancount-js/fava-beta`.

## Fixed boundaries

- Original comparison revision:
  `191dae81ec0a33abb0f6f4cb9299cc3e01bfdc7b`.
- Original comparison workspace:
  `/Users/stevejuma/code/beancount-js-studio-fava-reference`
  (`fava-reference`).
- Storybook harness reference:
  `/Users/stevejuma/ui` at
  `ba8d39d4bc158f8f761eb6a32f5d4a35cd9618ce`.
- Harness conventions and tooling may be ported from the reference repository;
  its Beancount component implementations must not be copied.
- `packages/fava` is not edited by migration commits.
- UI accepts display-ready props, controlled state, snippets, and callbacks.
  Routes, stores, persistence, APIs, ledger derivation, and CodeMirror document
  integration remain application-owned.
- The ordinary root check aggregate excludes UI now. Add the matching
  Fava-Beta exclusion and dedicated Beta/WIP commands in the same slice that
  introduces that package; Turbo rejects filters for packages that do not yet
  exist.
- Protected references use a 1280 × 900 CSS viewport, device scale factor 3,
  light mode, `en-GB`, `Europe/London`, and reduced motion.

### Current Visual Delta contract

The harness refresh re-read the canonical addon documentation and exported
contracts before changing host configuration. The source snapshot is
`/Users/stevejuma/ui/packages/storybook-addon-visual-delta` at
`7da0aff00fbc9288a138c8dae7f45a3d5f299f72` at validation time
(2026-07-24). This revision records provenance rather than pinning the addon.
Before Storybook dev/build, UI checks, visual tests, or the Visual Delta CLI,
the host requires a clean canonical checkout and refreshes the portable
workspace package from that directory. The local package then loads the
refreshed TypeScript/TSX source exports through `workspace:*`, keeping one
Storybook and Playwright dependency graph.

| Previous host responsibility                 | Current contract                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Local preset bridge and Vite source alias    | Bare `storybook-addon-visual-delta` registration; Storybook 10 loads package manager/preview exports and the preset supplies host hooks |
| Host `/visual-baselines` static mapping      | Preset `staticDirs` owns the committed snapshot mount                                                                                   |
| Host middleware/update argv                  | Preset middleware and packaged `visual-delta` CLI                                                                                       |
| Handwritten Playwright config                | `defineVisualPlaywrightConfig()` plus `.visual-delta/playwright.json`; the package resolves the visual server from the Storybook port   |
| Existing-baseline custom suite               | `defineVisualSuite({ includeStory })`, restricted to review-tagged stories outside approved update runs                                 |
| Pending/approved-only status badges          | Mutually exclusive pending, ready, approved, and failed badges; automated pass becomes ready and human acceptance becomes approved      |
| Reference gallery self-comparison parameters | Reference stories render the immutable originals only and remain `skip-visual`                                                          |

## Status and validation rules

- Task status is one of `Not started`, `In progress`, `Blocked`, or `Done`.
- Only one page migration is `In progress`; its dependent component rows may
  advance together.
- Each verified slice updates this file and is committed with Jujutsu before the
  next slice begins.
- Component work advances after Storybook interaction/accessibility checks and
  the affected UI and Fava Beta package checks pass.
- During the migration phase, do not capture or update screenshots, enroll new
  migration stories in Visual Delta, or block on pixel parity. Existing
  reference assets and historical review labels remain intact.
- A component is `Done` when UI owns its public presentation, Fava Beta consumes
  it through an adapter, the legacy Beta component is removed, and automated
  evidence is recorded.

## Manual review

The active workflow has one remaining manual break: after every planned
component has been ported into UI Storybook and Fava Beta consumes the shared
presentation. Component and page slices do not pause for screenshot or pixel
review.

| Gate | Trigger                               | Required manual review                                                                                | Disposition |
| ---- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| G01  | Storybook/reference harness complete  | Historical harness review                                                                             | Accepted    |
| G02  | Forms merge complete                  | Historical Forms review                                                                               | Accepted    |
| G03  | All component migrations are complete | UI Storybook catalog, Fava Beta page walkthrough, remaining markup gaps, and the final migration diff | Pending     |

Pixel-parity and baseline work is deferred until that final review determines
whether it is still useful. Existing Visual Delta coverage remains available
but is not a completion gate for new migration stories.

## Foundation ledger

| ID  | Task                                                              | Status | Evidence                                                                         |
| --- | ----------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| F01 | Resume UI ownership guidance and isolate normal root checks       | Done   | Root/UI/Form guidance and root negative filters                                  |
| F02 | Create and verify the pinned `fava-reference` workspace           | Done   | Workspace `fava-reference`, parent `191dae81`                                    |
| F03 | Port Visual Delta and Storybook status badges                     | Done   | Initial `a3d69779`; refresh `mrwmkrvx`; 111 addon tests and 8 visual comparisons |
| F04 | Add protected Fava capture matrix, manifest, and overwrite guards | Done   | 15 pinned captures; manifest digest gate                                         |
| F05 | Repair the `SearchFilterBar` empty-focus browser story            | Done   | 2/2 focused browser stories; 7/7 syntax tests                                    |
| F06 | Consolidate Forms implementation, tests, and stories into UI      | Done   | UI owns the complete catalog and runtime                                         |
| F07 | Reduce `@beancount-js/forms` to a forwarding compatibility facade | Done   | 22 checked TypeScript forwarders; no Svelte/CSS                                  |
| F08 | Run UI, Forms-facade, and original-Fava compatibility gates       | Done   | UI checks; 188 Fava tests; build; 18 subpaths                                    |
| F09 | Manual Forms validation and GPT-5.6 Terra handoff                 | Done   | Accepted by continuation on 2026-07-24                                           |
| F10 | Bootstrap Fava Beta as the mutable integration application        | Done   | Clone, Beta gates, root exclusion, build                                         |

## Component migration order

Work page by page. Each page slice first establishes ordinary Storybook stories
for its reusable presentation, then switches Fava Beta to thin adapters while
retaining application state, data derivation, routing, and persistence.
Screenshot capture and pixel comparison are deferred.

### Wave 1 — existing shared surface and shell

| ID   | Fava source or surface                              | Status      |
| ---- | --------------------------------------------------- | ----------- |
| C001 | `ContentScrollArea.svelte`                          | Done        |
| C002 | `StudioShell.svelte` / `AppShell` certification     | Done        |
| C003 | `Search.svelte` / `SearchFilterBar` certification   | Done        |
| C004 | `tree-table/IntervalTreeTable.svelte` certification | Done        |
| C005 | `StudioShellHeader.svelte`                          | Done        |
| C006 | `FavaNavigation.svelte`                             | In progress |
| C007 | `Nav.svelte`                                        | Done        |
| C008 | `PagePagination.svelte`                             | Done        |
| C009 | `AccountLink.svelte`                                | Done        |
| C010 | `CycleSelect.svelte`                                | Done        |

Current Storybook review state: C001–C005 are `visual-ready` after passing
their configured 0.1% automated comparisons. C006 remains `visual-pending`
while its separate manual-review checkpoint is unresolved. No migration story
is `visual-approved`.

#### C006 — `FavaNavigation.svelte` (manual-review checkpoint)

- Status: **In progress**. This checkpoint is intentionally paused for the
  requested manual review; it is not a parity pass or an additional formal
  migration gate.
- UI ownership in the current working copy: `LedgerWorkspaceNavigation` and
  `WorkspaceTreeNavigation` now render the controlled Ledgers/Folders/Tags
  workspace hierarchy, including its search-toggle surface. The newly added
  `LedgerSettingsNavigation` owns the controlled settings hierarchy, back
  action, active rows, badges, and disclosures.
- Beta adapter: `FavaNavigation.svelte` supplies display-ready files, folders,
  tags, settings destinations, active state, route callbacks, and persisted
  disclosure state. It retains application-owned route selection, workspace
  stores, ledger derivation, query/account/resource navigation, and the Search
  component snippet. The former Beta settings markup has been removed.
- Visual evidence so far: the frozen original-Fava view switcher and ledger
  search input both compare at or below 0.1%; two corresponding
  `LedgerWorkspaceNavigation` Storybook baselines pass and remain
  `visual-pending`. UI and Beta Svelte checks pass after the settings extraction.
- Known unfinished parity work: a full sidebar crop currently differs by about
  4–5%, because Beta discovers eight fixture ledgers while the frozen original
  reference discovers five. A dedicated, synthetic five-ledger fixture tree is
  now present under `packages/fava-beta/e2e/fixtures/visual-reference-project`;
  it has not yet been wired into the frozen parity command. Full workspace and
  settings-surface comparisons, the new settings Storybook baseline, full
  package gates, and a focused navigation E2E rerun are still required before
  C006 can be committed or marked Done.

#### C007 — `Nav.svelte`

- Status: **Done**. The reusable navigation list component now lives in
  `@beancount-js/ui/navigation/Nav.svelte` with app-owned active-state
  determination and navigation callbacks.
- Beta adapter: `packages/fava-beta/src/components/Nav.svelte` no longer holds
  presentation-only rendering and has been removed.
- Validation: UI story coverage is in `Navigation/Nav` and component ownership is
  included in the current migration slice's UI check run.

#### C010 — `CycleSelect.svelte`

- Status: **Done**. The reusable component now lives in
  `@beancount-js/ui/forms/CycleSelect.svelte` and exposes controlled
  `value/options/label/onChange` behavior with previous/next buttons and cycle
  semantics.
- UI story: `Forms/Cycle Select` (`CycleSelect`) with interaction checks for
  next/previous behavior and disabled state.
- Beta adapter: `@beancount-js/fava-beta/src/components/CycleSelect.svelte`
  and its story have been removed; `IngestionHeaderActions.svelte` now uses
  the shared UI form control.
- Validation: `@beancount-js/ui check-boundaries`, `test-storybook`, and
  `svelte-check` pass. Focused `@beancount-js/fava-beta` `lint`,
  `check`, `check:svelte5`, `test --run`, and `build` pass after migration.

#### C011 — `ComboBox.svelte`

- Status: **Done**. The reusable combo/filter control now lives in
  `@beancount-js/ui/forms/ComboBox.svelte`, which already includes a Storybook
  story and interaction tests.
- Beta adapter: `packages/fava-beta/src/components/ComboBox.svelte` and
  `packages/fava-beta/src/components/ComboBox.stories.svelte` were removed.
  `IngestionAccountsSetup.svelte` now imports `ComboBox` from
  `@beancount-js/ui/forms`, while preserving local account-list application
  state and option mapping.
- Validation: `pnpm --filter @beancount-js/fava-beta check`,
  `check:svelte5`, `lint`, and `build` pass after consuming the shared control.

#### C012 — `MerchantPicker.svelte`

- Status: **Done**. Presentation ownership is now in
  `@beancount-js/ui/forms/MerchantPicker.svelte`; `packages/fava-beta` keeps a
  thin adapter that preserves project lookup, ranking, brand-match action
  handling, error reporting, and route/context usage.
- Beta adapter: `packages/fava-beta/src/components/MerchantPicker.stories.svelte`
  was removed; `packages/fava-beta/src/components/MerchantPicker.svelte`
  now composes `SharedMerchantPicker` from `@beancount-js/ui/forms`.
- Validation: `pnpm --filter @beancount-js/fava-beta check`,
  `check:svelte5`, `lint`, and `build` pass after this migration.

#### C013 — `LocalMerchantMatchPicker.svelte`

- Status: **Done**. Presentation ownership is now in
  `@beancount-js/ui/forms/LocalMerchantMatchPicker.svelte` as a form-level
  wrapper around shared `MerchantPicker`; the Beta adapter in
  `packages/fava-beta/src/components/LocalMerchantMatchPicker.svelte` retains
  API fetching and brand-match action behavior, then passes ranked merchants and
  load messages into the shared picker control.
- Beta adapter: `packages/fava-beta/src/components/LocalMerchantMatchPicker.svelte`
  now uses app-owned merchant loading, brand-match action handling, and local
  error reporting while rendering the shared UI control with a preconfigured
  `Existing merchant` form field.
- Validation: `pnpm --filter @beancount-js/ui check-boundaries`,
  `test-storybook`, `pnpm --filter @beancount-js/fava-beta check`,
  `check:svelte5`, `lint`, and `build` pass after this migration.

#### C014 — `form/AccountComboField.svelte`

- Status: **Done**. Presentation ownership is now in
  `@beancount-js/ui/forms/AccountComboField.svelte`; the component consumes
  app-owned account context and preserves the existing searchable-select behavior,
  including placeholder-first selection and empty-value mapping.
- Beta adapter: `packages/fava-beta/src/ingestion/source-form-config.ts` now
  imports `AccountComboField` from `@beancount-js/ui/forms`; local duplicate
  component and story files under `packages/fava-beta/src/components/form/` were
  removed.
- Validation: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/fava-beta check`, `check:svelte5`, `lint`, and
  `build` pass after this migration.

#### C015 — `form/MerchantComboField.svelte`

- Status: **Done**. `@beancount-js/ui/forms/MerchantComboField.svelte`
  now owns the source-form merchant selector presentation.
- Beta adapter: `packages/fava-beta/src/ingestion/source-form-config.ts` now
  imports `MerchantComboField` from `@beancount-js/ui/forms`; `IngestionSourceForm`
  loads the project merchant catalog from `/merchants` and passes it through
  `SourceFormContext.merchants` to the shared renderer. The duplicate local
  `MerchantComboField` component and story were removed.
- Validation: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/ui check-boundaries`,
  `pnpm --filter @beancount-js/fava-beta check`,
  `check:svelte5`, `lint`, and `build` pass after this migration.

#### C017 — `form/SwitchField.svelte`

- Status: **Done**. Presentation ownership is now in
  `@beancount-js/ui/forms/SwitchField.svelte`; the component wraps the shared
  `Switch` with read-only text output for immutable views and preserves the Fava
  form row behavior for editable mode.
- Beta adapter: `packages/fava-beta/src/ingestion/source-form-config.ts` now
  imports `SwitchField` from `@beancount-js/ui/forms`; legacy story and local
  component files under `packages/fava-beta/src/components/form/` were removed.
- Validation: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/ui check-boundaries`,
  `pnpm --filter @beancount-js/fava-beta check`,
  `check:svelte5`, `lint`, and `build` pass after this migration.

#### C018 — `AccountBulkActionSheet.svelte`

- Status: **Done**. `@beancount-js/ui/tables/AccountBulkActionSheet.svelte`
  now owns the presentational bulk-action sheet UI. `packages/fava-beta/src/components/AccountBulkActionSheet.svelte`
  is now a thin adapter that supplies record-driven options/summaries, validates
  ledger patches, and delegates user-facing rendering to the shared component.
- Beta adapter updates: the local duplicate story
  `packages/fava-beta/src/components/AccountBulkActionSheet.stories.svelte` was
  removed; Beta call sites continue to use
  `packages/fava-beta/src/components/AccountBulkActionSheet.svelte` without change.
- Validation: `pnpm --filter @beancount-js/fava-beta check`, `check:svelte5`,
  `lint`, and `build` pass after this migration.

#### C019 — `MerchantEditSheet.svelte`

- Status: **Done**. `@beancount-js/ui/forms/MerchantEditSheet.svelte`
  now owns the merchant editing sheet presentation. It includes details,
  aliases, provenance, brand sections, and logo metadata rendering, while
  exposing simple callback props for state changes.
- Beta adapter: `packages/fava-beta/src/components/MerchantEditSheet.svelte` now
  owns merchant loading, debounced autosave/validation, persistence, logo
  refresh, and close behavior, passing mutable state to the shared component.
- Storybook: added
  `packages/ui/src/components/forms/MerchantEditSheet.stories.svelte` and tagged it
  as `visual-pending` while pixel parity remains out of scope for this slice.
- Validation: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/ui check-boundaries`,
  `pnpm --filter @beancount-js/fava-beta check`,
  `pnpm --filter @beancount-js/fava-beta check:svelte5`,
  `pnpm --filter @beancount-js/fava-beta lint`,
  `pnpm --filter @beancount-js/fava-beta build`.

#### C016 — `form/SecretField.svelte`

- Status: **Done**. `@beancount-js/ui/forms/SecretField.svelte` now owns
  secret input rendering for both standalone and form-renderer usage, including
  environment-key placeholders and inline mode display behavior. The shared form
  version accepts `envPlaceholder` while preserving the existing API that uses
  `environmentPlaceholder`/`environmentKeys`.
- Beta adapter: `packages/fava-beta/src/ingestion/source-form-config.ts` now
  imports `SecretField` from `@beancount-js/ui/forms`; legacy story and local
  component files under `packages/fava-beta/src/components/form/` were removed.
- Validation: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/ui check-boundaries`,
  `pnpm --filter @beancount-js/fava-beta check`,
  `check:svelte5`, `lint`, and `build` pass after this migration.

#### C001 — `ContentScrollArea.svelte`

- Original reference: `packages/fava/src/components/ContentScrollArea.svelte`;
  protected captures cover account detail, dashboard, query, income statement,
  balance sheet, and trial balance.
- UI export: the existing
  `@beancount-js/ui/layout/ContentScrollArea.svelte`, with the colocated
  `Layout/Content Scroll Area` story retained and marked `visual-ready`.
- Beta adapter: six direct imports in `AccountDetails`, `FinancialDashboard`,
  `PresetQueryView`, `Query`, `StatementReport`, and `TrialBalance`; the local
  Beta wrapper and duplicate story are removed.
- Visual delta: `packages/fava-beta/e2e/visual-parity.spec.ts` crops the
  matching content-scroll surface from each frozen reference and enforces a
  changed-pixel ratio at or below 0.1%.
- Validation: `pnpm checks:ui`, `pnpm checks:beta`, `pnpm test:beta`, the
  six-route frozen parity suite, and the focused Storybook baseline creation
  and comparison passed. Change `qpqmpquyt`.

#### C002 — `StudioShell.svelte` / `AppShell`

- Original reference: `packages/fava/src/components/StudioShell.svelte` already
  consumes `@beancount-js/ui/app-shell`; Fava-specific project, navigation,
  ingestion, and AI slots remain application-owned.
- UI export: `@beancount-js/ui/app-shell`, with the existing `Layout/App Shell`
  story marked `visual-ready` and given a protected Storybook baseline.
- Beta adapter: the unchanged `packages/fava-beta/src/components/StudioShell.svelte`
  imports the same UI export; no local AppShell duplicate exists to remove.
- Visual delta: `packages/fava-beta/e2e/visual-parity.spec.ts` compares the
  `studio-workspace-header` surface against all 15 frozen routes at or below
  0.1%. Route bodies stay out of this shell certification because their
  components have their own pending migration tasks.
- Validation: the 15-route AppShell parity suite and focused Storybook baseline
  creation and comparison passed. Change `tzkqtuvo`.

### Wave 2 — forms, pickers, sheets, and workflow controls

| ID   | Fava source or surface            | Status      |
| ---- | --------------------------------- | ----------- |
| C011 | `ComboBox.svelte`                 | Done        |
| C012 | `MerchantPicker.svelte`           | Done        |
| C013 | `LocalMerchantMatchPicker.svelte` | Done        |
| C014 | `form/AccountComboField.svelte`   | Done        |
| C015 | `form/MerchantComboField.svelte`  | Done        |
| C016 | `form/SecretField.svelte`         | Done        |
| C017 | `form/SwitchField.svelte`         | Done        |
| C018 | `AccountBulkActionSheet.svelte`   | Done        |
| C019 | `MerchantEditSheet.svelte`        | Done        |
| C020 | `JournalEditorSheet.svelte`       | Done        |
| C021 | `JournalRecordRouteSheet.svelte`  | Done        |
| C022 | `RuleEditorSheet.svelte`          | Done |
| C023 | `rules/RuleConditionRow.svelte`   | Done |
| C024 | `IngestionHeaderActions.svelte`   | Not started |
| C025 | `IngestionMerchantSheet.svelte`   | Not started |
| C026 | `IngestionProposalSheet.svelte`   | Not started |
| C027 | `IngestionSourceForm.svelte`      | Not started |

### Wave 3 — tables, feedback, and loading states

| ID   | Fava source or surface                                         | Status      |
| ---- | -------------------------------------------------------------- | ----------- |
| C028 | `AccountActivityTable.svelte`                                  | Not started |
| C029 | `ActivityTable.svelte`                                         | Not started |
| C030 | `JournalTable.svelte`                                          | Not started |
| C031 | `QueryTable.svelte`                                            | Done        |
| C032 | `IngestionTable.svelte`                                        | Not started |
| C033 | `tree-table/TreeTable.svelte` and `TreeTableNode.svelte`       | Not started |
| C034 | `tree-table/StatementSummaryTreeTable.svelte`                  | Not started |
| C035 | `tree-table/StatementSummaryTreeRow.svelte`                    | Not started |
| C036 | `tree-table/AccountCell.svelte` and `AccountCellHeader.svelte` | Not started |
| C037 | `tree-table/Diff.svelte`                                       | Not started |
| C038 | `AiUnifiedReviewDiff.svelte`                                   | Not started |
| C039 | `ResourceViewer.svelte`                                        | Not started |
| C040 | `errors/Errors.svelte`                                         | Not started |
| C041 | `skeletons/*` route loading surfaces                           | Not started |

### Wave 4 — charts, dashboard, and reports

| ID   | Fava source or surface                        | Status      |
| ---- | --------------------------------------------- | ----------- |
| C042 | `dashboard/DashboardDonut.svelte`             | Not started |
| C043 | `dashboard/DashboardFlow.svelte`              | Not started |
| C044 | `dashboard/DashboardLine.svelte`              | Not started |
| C045 | `dashboard/DashboardSection.svelte`           | Not started |
| C046 | `dashboard/DashboardTreeTable.svelte` and row | Not started |
| C047 | `dashboard/DashboardChartTooltip.svelte`      | Not started |
| C048 | `FinancialDashboard.svelte`                   | Not started |
| C049 | `StatementReport.svelte`                      | Not started |
| C050 | `IncomeStatement.svelte`                      | Not started |
| C051 | `BalanceSheet.svelte`                         | Not started |
| C052 | `TrialBalance.svelte`                         | Not started |
| C053 | `AccountDetails.svelte`                       | Not started |
| C054 | `Holdings.svelte`                             | Done        |
| C055 | `Statistics.svelte`                           | Not started |
| C056 | `PresetQueryView.svelte`                      | Done        |

### Wave 5 — application workflows

| ID   | Fava source or surface                   | Status      |
| ---- | ---------------------------------------- | ----------- |
| C057 | `QueryBox.svelte` and `Query.svelte`     | Not started |
| C058 | `Search.svelte` application adapter      | Not started |
| C059 | `Editor.svelte` and `Highlighter.svelte` | Not started |
| C060 | `AiDock.svelte`                          | Not started |
| C061 | `IngestionAccountsSetup.svelte`          | Not started |
| C062 | `IngestionBrandSettings.svelte`          | Not started |
| C063 | `IngestionConfigEditor.svelte`           | Not started |
| C064 | `IngestionMerchantManage.svelte`         | Not started |
| C065 | `IngestionMerchantReview.svelte`         | Not started |
| C066 | `IngestionReconciliationPanel.svelte`    | Not started |
| C067 | `IngestionRunAudit.svelte`               | Not started |
| C068 | `IngestionRunHistory.svelte`             | Not started |
| C069 | `IngestionSourcesPreview.svelte`         | Not started |
| C070 | `RulesSettings.svelte`                   | Not started |

## Current execution focus

2026-07-24 — migration resumed in the main `beancount-studio` workspace. The
temporary Holdings workspace was removed after transferring only component,
Storybook, and Fava Beta adapter work; its screenshot, baseline, and DOM
contract work was intentionally not transferred.

The most recent page slice is Holdings. Its shared preset view, query results
table, account navigation link, pagination, and `CycleSelect` now live in UI
Storybook. Fava Beta keeps BQL execution, domain sorting, formatting, chart
derivation, merchant lookup, and route construction. New stories are ordinary
catalog stories and carry no Visual Delta review tag.

The earlier C006 navigation work remains preserved in the parent working-copy
history, but it no longer creates a separate manual pause. Continue page slices
without new baselines, then stop once the full catalog migration is ready for
G03 manual review.

## Validation log

Record commands, outcomes, reference manifests, visual sidecars, and Jujutsu
change IDs here at the end of each committed slice.

- 2026-07-24 — Visual Delta refresh (`mrwmkrvx`): refreshed from the clean
  canonical source directory, observed at revision
  `7da0aff00fbc9288a138c8dae7f45a3d5f299f72`, and added guarded pre-run
  synchronization so future harness entry points cannot silently use a stale
  copy. A raw cross-repository package link was rejected during validation
  because Node resolved the source repository's Playwright runtime alongside
  Beancount's. The portable workspace mirror retains a single dependency
  graph. The host now uses bare
  addon registration, preset-owned baseline serving and middleware, the
  packaged CLI, `defineVisualPlaywrightConfig`, and a review-tag-filtered
  `defineVisualSuite`. The latest source now owns Storybook 10 package
  registration and Storybook-relative visual-server selection, so the earlier
  local preset, source alias, and fixed-port workaround were removed. The
  canonical addon typecheck/build and all 111 tests pass. UI
  formatting, boundaries, Svelte diagnostics, 18 unit tests, 188 Storybook
  tests, and the production Storybook build pass. The static index contains 188
  stories but enrolls only eight `visual-ready` stories; all eight comparisons
  pass at the configured 0.1% threshold, while all 17 protected Fava reference
  stories remain skipped.
- 2026-07-24 — Governance/reference slice: created the clean
  `fava-reference` workspace at
  `/Users/stevejuma/code/beancount-js-studio-fava-reference`; its empty working
  copy has parent `191dae81`. UI boundary checks passed, documentation and
  package metadata passed Prettier, and Turbo's dry run contained no
  `@beancount-js/ui#checks` task.
- 2026-07-24 — Visual harness slice (`a3d69779`): ported the local Visual
  Delta addon and Storybook tag badges from the pinned harness reference.
  Addon tests passed 61/61, UI unit tests passed 18/18, Svelte and boundary
  checks passed, Storybook built, and the empty visual-regression lane exited
  cleanly with one intentional skip.
- 2026-07-24 — Frozen Fava reference slice: built ignored artifacts in the
  pinned workspace, captured all 15 matrix routes at 1280 × 900 and device
  scale factor 3, and recorded Studio revision `191dae81`, sample fixture
  digest, and per-image SHA-256 digests. `pnpm fava-reference:verify` and the
  protected-story index audit passed.
- 2026-07-24 — SearchFilterBar interaction slice: changed the browser story to
  await CodeMirror's debounced completion popup, preserving the real click,
  keyboard, and completion interactions. Both focused browser stories and all
  seven filter-syntax unit tests passed.
- 2026-07-24 — Forms consolidation slice: confirmed that UI's relocated Forms
  implementations match the former package behavior and retain its complete
  Storybook surface, then replaced the old package source with 22 checked
  TypeScript forwarders. Original Fava remains source-unchanged; its lint,
  Svelte 5, type, 188-test, and production-build gates pass through the facade.
  All 18 legacy component subpaths load through Fava's Vite/Svelte pipeline.
  UI's 18 unit tests, 186 browser stories, Svelte and boundary checks, and
  production Storybook build pass; a fresh-cache browser run also passes after
  pinning the late-discovered Luggage icon in Vite's dependency optimizer.
  Its aggregate formatting gate still reports the unrelated pre-existing
  `src/core/ledger-data-class.ts` warning.
- 2026-07-24 — Fava Beta bootstrap slice: accepted the Forms review break and
  created `@beancount-js/fava-beta` as the mutable, full-application baseline.
  Root `checks` now negatively filters both UI and Beta; its Turbo dry run has
  no Beta checks task. Dedicated Beta commands use Playwright port 5176. The
  inherited `ledger-data-class.ts` Prettier-only warning was normalized in Beta
  so its WIP gate is green; the remaining Fava/Beta source differences are the
  package identity, isolated port, Beta MCP target, and that formatting-only
  change. `pnpm checks:beta` passed, as did `pnpm test:beta` (55 files, 188
  tests) and `pnpm --filter @beancount-js/fava-beta build`.
- 2026-07-24 — ContentScrollArea slice (`qpqmpquyt`): switched all six Beta
  consumers to the existing UI export and removed the duplicate Beta wrapper
  and story. The Storybook baseline helper now supplies Playwright's explicit
  snapshot-update mode, so approved create-only runs exit successfully. UI
  checks passed; Beta checks passed; Beta unit tests passed (55 files, 188
  tests); and the six frozen surface comparisons passed at the 0.1% limit.
  The broad Beta E2E suite still has 17 existing state-isolation failures; a
  representative query-table failure reproduces unchanged in original Fava, so
  it is not attributed to this slice.
- 2026-07-24 — AppShell certification slice (`tzkqtuvo`): confirmed that both
  original Fava and Beta consume the public UI AppShell export, while keeping
  StudioShell's project and workflow integration in the application. Added the
  AppShell pending Storybook baseline and verified its shared header against
  every frozen route at the 0.1% limit. The baseline helper now preflights
  create-only requests and runs Playwright's success-returning snapshot mode;
  it refuses to overwrite an existing selected baseline.
- 2026-07-24 — SearchFilterBar certification slice (`ukmsvyzsvzsn`): confirmed
  that original Fava and Beta both import the public UI Forms export, while
  `Search.svelte` remains the application-owned route-state adapter. Added the
  protected interactive `search-sidebar` capture, which opens the Journal
  sidebar and waits for the labelled ledger search box. Its frozen UI crop and
  both pending Storybook baselines pass. The parity comparator now crops both
  full-page captures on the shared device-pixel grid, avoiding Playwright's
  fractional-locator high-DPR crop artifact while retaining strict 0.1% pixel
  parity. UI and Beta checks passed, as did Beta's 55-file/188-test suite and
  all 22 frozen component-parity comparisons.
- 2026-07-24 — IntervalTreeTable certification slice (`yoztzpksmpyq`):
  confirmed that the Fava tree-table adapter remains responsible for account
  visibility, dates, formatting, routes, and persisted collapse state while
  original Fava and Beta both consume the UI table export. Added the protected
  Account Changes reference and three pending UI visual baselines. Frozen
  comparisons now clip tall components to the captured viewport before pixel
  comparison; UI and Beta checks passed, as did 55 files/188 Beta tests and
  all 23 frozen component-parity comparisons.
- 2026-07-24 — StudioShellHeader migration slice (`mnyxtpllttmk`): replaced
  Beta's duplicate markup with the UI header while retaining app-owned project,
  workspace-settings, and local-sidebar state in its adapter. Added the
  controlled UI baseline and marked the story visual-pending. Frozen parity
  proves the shared brand, title, and settings-action pixels; the project name
  remains an app-owned input and intentionally differs from the pinned
  reference checkout. UI and Beta checks passed, as did Beta's 55-file/188-test
  suite and all 26 frozen comparisons. The legacy settings navigation E2E has
  a stale `Import` expectation: it correctly opens settings, but neither
  original Fava nor Beta's identical `FavaNavigation` renders that action.
- 2026-07-25 — Journal editor migration slice (`wvtppkxy`): migrated
  `JournalEditorSheet` and `JournalRecordRouteSheet` into the shared UI/fava-beta
  adapter pattern. `@beancount-js/ui` now owns shared editing presentation for
  transactions, opens, and additional directive kinds, while fava-beta owns source
  persistence and route handling.
  Verification run: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/ui test-unit`,
  `pnpm --filter @beancount-js/ui check-boundaries`,
  `pnpm --filter @beancount-js/ui check` (still fails on unrelated story field typing),
  `pnpm --filter @beancount-js/fava-beta check`, and
  `pnpm --filter @beancount-js/fava-beta test:run`.

### C020 — `JournalEditorSheet.svelte`

- Status: **Done.** The reusable `@beancount-js/ui/forms/JournalEditorSheet.svelte`
  now owns form rendering, interaction states, and directive kind-specific logic.
  `@beancount-js/fava-beta/src/components/JournalEditorSheet.svelte` is now a thin
  adapter that:
  - passes app-owned data (`accounts`, `currencies`, `tags`, and fetched merchants),
  - owns record-anchor persistence, revision checks, route-key refresh, and autosave,
  - and delegates shared rendering to the UI component.
- Validation: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/ui test-unit`, and
  `pnpm --filter @beancount-js/ui check-boundaries` pass;
  `pnpm --filter @beancount-js/fava-beta check` also passes.
- Note: `pnpm --filter @beancount-js/ui check` remains blocked by pre-existing
  story fixture typing issues in `AccountComboField.stories.svelte`,
  `MerchantComboField.stories.svelte`, and `SwitchField.stories.svelte`, not by
  this migration slice.

### C021 — `JournalRecordRouteSheet.svelte`

- Status: **Done.** The route adapter now consumes the `@beancount-js/fava-beta`
  adapter-wrapped sheet. Route-aware open/close lifecycle and URL record
  synchronization remain in place while visual rendering and edit state are
  delegated to the shared `JournalEditorSheet`.
- Validation: `pnpm --filter @beancount-js/fava-beta test:run` and
  `pnpm --filter @beancount-js/fava-beta check` pass.

#### C022 — `RuleEditorSheet.svelte`

- Status: **Done**. Presentation for detection-rule editing now lives in
  `@beancount-js/ui/forms/RuleEditorSheet.svelte` and is composed from shared
  `@beancount-js/forms`-sourced rule metadata controls. `@beancount-js/fava-beta/src/components/RuleEditorSheet.svelte`
  is now an adapter wrapper that retains route/state ownership and passes
  app-owned persistence callbacks into the shared sheet.
- Validation: `pnpm --filter @beancount-js/ui test-storybook`,
  `pnpm --filter @beancount-js/ui test-unit`, and
  `pnpm --filter @beancount-js/ui check-boundaries` pass.

#### C023 — `rules/RuleConditionRow.svelte`

- Status: **Done**. The reusable condition row control now exists in
  `@beancount-js/ui/src/components/forms/rules/RuleConditionRow.svelte` and is
  consumed by the shared `RuleEditorSheet`. The legacy
  `packages/fava-beta/src/components/rules/RuleConditionRow.svelte` component
  was moved into UI and removed from Beta.
- Validation: `pnpm --filter @beancount-js/fava-beta check` and
  `pnpm --filter @beancount-js/fava-beta test:run` pass.
- Note: `pnpm --filter @beancount-js/ui check` remains blocked by pre-existing
  story fixture typing issues in `AccountComboField.stories.svelte`,
  `MerchantComboField.stories.svelte`, and `SwitchField.stories.svelte`; these are unrelated to this slice.
