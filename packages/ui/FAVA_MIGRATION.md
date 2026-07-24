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

## Status and validation rules

- Task status is one of `Not started`, `In progress`, `Blocked`, or `Done`.
- Only one foundation or component task is `In progress`.
- Each verified slice updates this file and is committed with Jujutsu before the
  next slice begins.
- Component work advances automatically after interaction, accessibility,
  package, and visual-delta checks pass. A comparable component must be at or
  below 0.1% difference.
- Passing component stories remain `visual-pending` until the final manual
  parity audit. `visual-approved` is applied only as a final reviewed batch.
- A component is `Done` when UI owns its public presentation, Fava Beta consumes
  it through an adapter, the legacy Beta component is removed, and automated
  evidence is recorded.

## Manual breaks and model handoff

There are exactly three manual validation breaks. When a new break is reached,
the migration records the evidence packet below and waits for explicit human
acceptance before it starts the following stage. Component tasks do not add
per-component pauses.

| Gate | Trigger                              | Required manual review                                                                                                              | Disposition                                                                          |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| G01  | Storybook/reference harness complete | Visual Delta status treatment, protected-reference overwrite guard, and one representative reference capture                        | Accepted by the subsequent continuation directive on 2026-07-24                      |
| G02  | Forms merge complete                 | Forms catalog, legacy-facade compatibility, and original-Fava compatibility evidence                                                | Accepted by the subsequent continuation directive on 2026-07-24                      |
| G03  | Final parity audit complete          | All `visual-pending` stories, unresolved visual sidecars, representative desktop and responsive routes, and the final diff manifest | Pending — stop before applying `visual-approved` or declaring the migration complete |

G01 and G02 were already complete when this explicit gate policy was added; the
recorded continuation is their transition evidence, not a substitute for the
listed review packet. The first two foundation phases use GPT-5.6 Sol. After
G02, hand component iteration to GPT-5.6 Terra. Return to GPT-5.6 Sol for G03.

## Foundation ledger

| ID  | Task                                                              | Status | Evidence                                        |
| --- | ----------------------------------------------------------------- | ------ | ----------------------------------------------- |
| F01 | Resume UI ownership guidance and isolate normal root checks       | Done   | Root/UI/Form guidance and root negative filters |
| F02 | Create and verify the pinned `fava-reference` workspace           | Done   | Workspace `fava-reference`, parent `191dae81`   |
| F03 | Port Visual Delta and Storybook status badges                     | Done   | Change `a3d69779`; 61 addon tests               |
| F04 | Add protected Fava capture matrix, manifest, and overwrite guards | Done   | 15 pinned captures; manifest digest gate        |
| F05 | Repair the `SearchFilterBar` empty-focus browser story            | Done   | 2/2 focused browser stories; 7/7 syntax tests   |
| F06 | Consolidate Forms implementation, tests, and stories into UI      | Done   | UI owns the complete catalog and runtime        |
| F07 | Reduce `@beancount-js/forms` to a forwarding compatibility facade | Done   | 22 checked TypeScript forwarders; no Svelte/CSS |
| F08 | Run UI, Forms-facade, and original-Fava compatibility gates       | Done   | UI checks; 188 Fava tests; build; 18 subpaths   |
| F09 | Manual Forms validation and GPT-5.6 Terra handoff                 | Done   | Accepted by continuation on 2026-07-24          |
| F10 | Bootstrap Fava Beta as the mutable integration application        | Done   | Clone, Beta gates, root exclusion, build        |

## Component migration order

Every source below is an individual task. Add its reference path, UI export,
Beta adapter, delta, validation commands, and committed change when it becomes
`In progress`.

### Wave 1 — existing shared surface and shell

| ID   | Fava source or surface                              | Status      |
| ---- | --------------------------------------------------- | ----------- |
| C001 | `ContentScrollArea.svelte`                          | Done        |
| C002 | `StudioShell.svelte` / `AppShell` certification     | Done        |
| C003 | `Search.svelte` / `SearchFilterBar` certification   | Not started |
| C004 | `tree-table/IntervalTreeTable.svelte` certification | Not started |
| C005 | `StudioShellHeader.svelte`                          | Not started |
| C006 | `FavaNavigation.svelte`                             | Not started |
| C007 | `Nav.svelte`                                        | Not started |
| C008 | `PagePagination.svelte`                             | Not started |
| C009 | `AccountLink.svelte`                                | Not started |
| C010 | `CycleSelect.svelte`                                | Not started |

#### C001 — `ContentScrollArea.svelte`

- Original reference: `packages/fava/src/components/ContentScrollArea.svelte`;
  protected captures cover account detail, dashboard, query, income statement,
  balance sheet, and trial balance.
- UI export: the existing
  `@beancount-js/ui/layout/ContentScrollArea.svelte`, with the colocated
  `Layout/Content Scroll Area` story retained and marked `visual-pending`.
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
  story marked `visual-pending` and given a protected Storybook baseline.
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
| C011 | `ComboBox.svelte`                 | Not started |
| C012 | `MerchantPicker.svelte`           | Not started |
| C013 | `LocalMerchantMatchPicker.svelte` | Not started |
| C014 | `form/AccountComboField.svelte`   | Not started |
| C015 | `form/MerchantComboField.svelte`  | Not started |
| C016 | `form/SecretField.svelte`         | Not started |
| C017 | `form/SwitchField.svelte`         | Not started |
| C018 | `AccountBulkActionSheet.svelte`   | Not started |
| C019 | `MerchantEditSheet.svelte`        | Not started |
| C020 | `JournalEditorSheet.svelte`       | Not started |
| C021 | `JournalRecordRouteSheet.svelte`  | Not started |
| C022 | `RuleEditorSheet.svelte`          | Not started |
| C023 | `rules/RuleConditionRow.svelte`   | Not started |
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
| C031 | `QueryTable.svelte`                                            | Not started |
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
| C054 | `Holdings.svelte`                             | Not started |
| C055 | `Statistics.svelte`                           | Not started |
| C056 | `PresetQueryView.svelte`                      | Not started |

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

## Validation log

Record commands, outcomes, reference manifests, visual sidecars, and Jujutsu
change IDs here at the end of each committed slice.

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
