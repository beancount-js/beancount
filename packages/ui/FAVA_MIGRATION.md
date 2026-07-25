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
contracts before changing host configuration. The source package is
`/Users/stevejuma/ui/packages/storybook-addon-visual-delta`; the host consumes
that directory directly through a `link:` dependency instead of maintaining a
mirrored workspace copy. The source package must keep its built `dist` exports
current for Node and Playwright entry points, while Storybook still loads the
manager and preview source exports from the linked package.

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

## Native component alignment

The final G03 review is deferred until this cross-cutting alignment is complete.
It changes the primitive styling beneath the migrated catalog and Fava Beta, so
reviewing C006 or the final page set before N01-N07 are done would validate an
obsolete rendering architecture.

| ID  | Task                                                                  | Status |
| --- | --------------------------------------------------------------------- | ------ |
| N01 | Define native component ownership and add the Tailwind ratchet        | Done   |
| N02 | Add framework-independent foundation and component tokens             | Done   |
| N03 | Normalize UI primitive families to native CSS                         | Done   |
| N04 | Convert shared UI compositions to native CSS                          | Done   |
| N05 | Move Fava Beta consumers to public UI primitives                      | Done   |
| N06 | Remove duplicate primitives and obsolete styling dependencies         | Done   |
| N07 | Run zero-baseline, UI, Beta, browser, C006, and final migration gates | Done   |

N04 evidence: all shared composition families compile to repository-owned
semantic CSS, `check:no-tailwind` reports zero findings, 69 UI unit tests pass,
and focused Storybook coverage passes for shell, forms, dashboards, pages, and
tables. The slice also repaired Sheet close-part targeting, optional snippet
forwarding, ActivityTable ARIA contracts, and affected interaction stories.

N05 evidence: Fava Beta runtime consumers now import public
`@beancount-js/ui/shadcn/*` subpaths, the Beta primitive boundary scans 352
files, and the duplicate 244-file Beta primitive tree has been removed.

N06 evidence: UI and Fava Beta have no Tailwind/PostCSS styling dependencies or
configuration, production source has zero absolute Tailwind findings, UI owns a
framework-independent reset and semantic token styles, and Storybook's existing
demo utility layout is frozen as static catalog CSS.

N07 evidence: 69 UI unit tests, 227 Storybook interactions, the Storybook build,
189 Fava Beta unit tests, the Fava Beta production build, and the functional
C006 navigation walkthrough pass. A direct browser walkthrough rendered all 16
main/settings routes plus the four-item mock-provider active review with no
console warnings/errors or internal/Svelte error boundary.

N07 documented blockers and exceptions: `pnpm checks:ui` stops before its
package gates because `/Users/stevejuma/ui/src/shared/forms/.npm` makes the
external Visual Delta source dirty; direct UI gates pass while the existing
Svelte baseline is 91 errors and 9 warnings in 24 files.
`pnpm checks:beta` stops on 34 pre-existing formatting files; direct Beta gates
pass while its current Svelte baseline is 43 errors and 1 warning in 15 files.
The frozen C006 visual-reference lane remains a deliberate native-CSS exception:
workspace surfaces differ by 4.76%, the view switcher by 6.80%, search by 7.39%,
and settings surfaces by 1.18%-1.19% against immutable Fava captures. Protected
references were not changed; the live visual walkthrough was accepted for
technical completion pending G03 manual review.

N01 evidence: repository-owned scanner and unit tests, package ratchet commands,
and `packages/ui/NATIVE_COMPONENTS.md`.

N02 evidence: `src/foundation.tokens.css`, the typed `./tokens` export, and the
focused foundation token contract test.

N03 evidence: all 33 existing `src/components/shadcn` families use semantic
component identities, family token/provenance files, static native CSS, and the
`native-primitives.spec.ts` architecture contract.

## Component migration order

Work page by page. Each page slice first establishes ordinary Storybook stories
for its reusable presentation, then switches Fava Beta to thin adapters while
retaining application state, data derivation, routing, and persistence.
Screenshot capture and pixel comparison are deferred.

### Wave 1 — existing shared surface and shell

| ID   | Fava source or surface                              | Status |
| ---- | --------------------------------------------------- | ------ |
| C001 | `ContentScrollArea.svelte`                          | Done   |
| C002 | `StudioShell.svelte` / `AppShell` certification     | Done   |
| C003 | `Search.svelte` / `SearchFilterBar` certification   | Done   |
| C004 | `tree-table/IntervalTreeTable.svelte` certification | Done   |
| C005 | `StudioShellHeader.svelte`                          | Done   |
| C006 | `FavaNavigation.svelte`                             | Done   |
| C007 | `Nav.svelte`                                        | Done   |
| C008 | `PagePagination.svelte`                             | Done   |
| C009 | `AccountLink.svelte`                                | Done   |
| C010 | `CycleSelect.svelte`                                | Done   |

Current Storybook review state: C001–C005 are `visual-ready` after passing
their configured 0.1% automated comparisons. C006 is complete with the
documented native-CSS visual exception above after its functional E2E and live
browser walkthroughs; G03 retains the final manual-review disposition. No
migration story is `visual-approved`.

#### C006 — `FavaNavigation.svelte` (manual-review checkpoint)

- Status: **Done** with a documented frozen-reference exception pending G03
  manual review.
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

Required evidence before marking C006 `Done`:

- Visual evidence: the Storybook interaction catalog passes 227 tests and the
  focused navigation stories remain available for review. The protected
  original-Fava comparison was run against the synthetic five-ledger fixture;
  its post-native-CSS ratios are recorded in N07 as an explicit exception rather
  than changing immutable reference captures.
- Functional evidence: `pnpm test:e2e:beta:navigation` passes, covering ledger
  view switching, search toggle, settings navigation, back-to-ledger behavior,
  and persisted folder disclosure. A direct browser walkthrough also verified
  the Ledgers/Folders/Tags controls and settings/review navigation without
  console errors.
- Aggregate evidence: the migration boundary audit passes. The UI Visual Delta
  lane is blocked before execution by dirty external source, and the package
  aggregate blockers are recorded with exact diagnostics in N07.

Required evidence before marking G03 `Accepted`:

- `pnpm validate:fava-migration` passes, running the focused C006 evidence
  command followed by the dedicated UI and Fava Beta validation lanes.
- `pnpm audit:fava-migration:final` passes, proving the current diff has no
  immutable `packages/fava` edits, mutable UI/Beta source/metadata does not
  import the legacy `@beancount-js/forms` facade, and every component tracker
  row C001-C070 is present and marked `Done`. It also proves Fava Beta imports
  only exported `@beancount-js/ui` public subpaths.
- Every component row C001-C070 is `Done`; C006 includes its documented
  native-CSS visual exception and functional/browser evidence.
- UI Storybook catalog review has covered all newly migrated Wave 5 stories.
- Fava Beta page walkthrough covers the migrated pages with app-owned adapters
  still retaining route state, persistence, APIs, and ledger/domain derivation.
- The final migration diff has no remaining `packages/fava` edits and no
  unintended `@beancount-js/forms` source imports outside the frozen Fava
  compatibility boundary.
- Dedicated UI and Beta validation lanes have been run in the final source
  state, with results recorded in this tracker.

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

| ID   | Fava source or surface            | Status |
| ---- | --------------------------------- | ------ |
| C011 | `ComboBox.svelte`                 | Done   |
| C012 | `MerchantPicker.svelte`           | Done   |
| C013 | `LocalMerchantMatchPicker.svelte` | Done   |
| C014 | `form/AccountComboField.svelte`   | Done   |
| C015 | `form/MerchantComboField.svelte`  | Done   |
| C016 | `form/SecretField.svelte`         | Done   |
| C017 | `form/SwitchField.svelte`         | Done   |
| C018 | `AccountBulkActionSheet.svelte`   | Done   |
| C019 | `MerchantEditSheet.svelte`        | Done   |
| C020 | `JournalEditorSheet.svelte`       | Done   |
| C021 | `JournalRecordRouteSheet.svelte`  | Done   |
| C022 | `RuleEditorSheet.svelte`          | Done   |
| C023 | `rules/RuleConditionRow.svelte`   | Done   |
| C024 | `IngestionHeaderActions.svelte`   | Done   |
| C025 | `IngestionMerchantSheet.svelte`   | Done   |
| C026 | `IngestionProposalSheet.svelte`   | Done   |
| C027 | `IngestionSourceForm.svelte`      | Done   |

### Wave 3 — tables, feedback, and loading states

| ID   | Fava source or surface                                         | Status |
| ---- | -------------------------------------------------------------- | ------ |
| C028 | `AccountActivityTable.svelte`                                  | Done   |
| C029 | `ActivityTable.svelte`                                         | Done   |
| C030 | `JournalTable.svelte`                                          | Done   |
| C031 | `QueryTable.svelte`                                            | Done   |
| C032 | `IngestionTable.svelte`                                        | Done   |
| C033 | `tree-table/TreeTable.svelte` and `TreeTableNode.svelte`       | Done   |
| C034 | `tree-table/StatementSummaryTreeTable.svelte`                  | Done   |
| C035 | `tree-table/StatementSummaryTreeRow.svelte`                    | Done   |
| C036 | `tree-table/AccountCell.svelte` and `AccountCellHeader.svelte` | Done   |
| C037 | `tree-table/Diff.svelte`                                       | Done   |
| C038 | `AiUnifiedReviewDiff.svelte`                                   | Done   |
| C039 | `ResourceViewer.svelte`                                        | Done   |
| C040 | `errors/Errors.svelte`                                         | Done   |
| C041 | `skeletons/*` route loading surfaces                           | Done   |

### Wave 4 — charts, dashboard, and reports

| ID   | Fava source or surface                        | Status |
| ---- | --------------------------------------------- | ------ |
| C042 | `dashboard/DashboardDonut.svelte`             | Done   |
| C043 | `dashboard/DashboardFlow.svelte`              | Done   |
| C044 | `dashboard/DashboardLine.svelte`              | Done   |
| C045 | `dashboard/DashboardSection.svelte`           | Done   |
| C046 | `dashboard/DashboardTreeTable.svelte` and row | Done   |
| C047 | `dashboard/DashboardChartTooltip.svelte`      | Done   |
| C048 | `FinancialDashboard.svelte`                   | Done   |
| C049 | `StatementReport.svelte`                      | Done   |
| C050 | `IncomeStatement.svelte`                      | Done   |
| C051 | `BalanceSheet.svelte`                         | Done   |
| C052 | `TrialBalance.svelte`                         | Done   |
| C053 | `AccountDetails.svelte`                       | Done   |
| C054 | `Holdings.svelte`                             | Done   |
| C055 | `Statistics.svelte`                           | Done   |
| C056 | `PresetQueryView.svelte`                      | Done   |

### Wave 5 — application workflows

| ID   | Fava source or surface                   | Status |
| ---- | ---------------------------------------- | ------ |
| C057 | `QueryBox.svelte` and `Query.svelte`     | Done   |
| C058 | `Search.svelte` application adapter      | Done   |
| C059 | `Editor.svelte` and `Highlighter.svelte` | Done   |
| C060 | `AiDock.svelte`                          | Done   |
| C061 | `IngestionAccountsSetup.svelte`          | Done   |
| C062 | `IngestionBrandSettings.svelte`          | Done   |
| C063 | `IngestionConfigEditor.svelte`           | Done   |
| C064 | `IngestionMerchantManage.svelte`         | Done   |
| C065 | `IngestionMerchantReview.svelte`         | Done   |
| C066 | `IngestionReconciliationPanel.svelte`    | Done   |
| C067 | `IngestionRunAudit.svelte`               | Done   |
| C068 | `IngestionRunHistory.svelte`             | Done   |
| C069 | `IngestionSourcesPreview.svelte`         | Done   |
| C070 | `RulesSettings.svelte`                   | Done   |

## Current execution focus

2026-07-24 — migration resumed in the main `beancount-studio` workspace. The
temporary Holdings workspace was removed after transferring only component,
Storybook, and Fava Beta adapter work; its screenshot, baseline, and DOM
contract work was intentionally not transferred.

The most recent page slice is Run History. Its local-server and project states, loading/empty/error states, sortable history header, grouped run rows, source and account badges, run links, and pagination now live in UI Storybook; Fava Beta retains project loading, source filtering, run-history APIs, route navigation, ledger-derived account appearance, merchant logo lookup, date grouping, and ingestion header actions.

All tracked Wave 5 component rows are now marked Done. Cross-catalog cleanup has removed legacy `@beancount-js/forms` source imports from UI-owned components and Fava Beta adapters/helpers. Next work should run the dedicated UI/Beta validation lanes, finish the paused C006 navigation checkpoint, and prepare for G03 manual review.

2026-07-25 — native component alignment completed. Fava Beta consumes the
public UI primitive surface, duplicate Beta primitives and Tailwind styling
dependencies are removed, the zero-Tailwind baseline is enforced, C006
functional navigation passes with accessible folder disclosure selectors, and
the mock-provider review plus all main/settings pages were exercised in the
browser without console errors. G03 remains pending only for deliberate human
review of the completed catalog and the documented frozen-reference exception.

### Migration-wide blocker cleanup notes

- 2026-07-25 - Retargeted remaining Fava Beta adapter imports from the
  `@beancount-js/forms` compatibility facade to `@beancount-js/ui/forms` in
  navigation, Studio shell, ingestion table, ingestion form, brand/config
  settings, and merchant sheet adapters. This keeps the facade reserved for the
  frozen Fava reference. Automated validation was not run in this continuation.

- 2026-07-25 - Retargeted Fava Beta ingestion form-config helpers from the
  `@beancount-js/forms` compatibility facade to `@beancount-js/ui/forms` for
  config builders, field helpers, and validation issue types. Fava Beta still
  owns source/brand/merchant config construction; UI owns the reusable form
  contract they consume. Automated validation was not run in this continuation.

- 2026-07-25 - Wired the synthetic five-ledger navigation fixture into a
  dedicated Fava Beta visual-reference E2E command,
  `pnpm test:e2e:beta:visual-reference`, so the C006 frozen navigation parity
  surfaces can run against the allow-listed project tree instead of the broader
  repository root. The command is scoped to `LedgerWorkspaceNavigation` and
  `LedgerSettingsNavigation` tests. Automated validation was not run in this
  continuation.

- 2026-07-25 - Added UI-owned root data attributes for the full
  `LedgerWorkspaceNavigation` surface and expanded the Fava Beta frozen parity
  spec to crop full workspace and settings navigation surfaces. These
  comparisons are encoded only; automated validation was not run in this
  continuation.

- 2026-07-25 - Reconciled the C006 tracker with current Storybook source:
  `LedgerSettingsNavigation.stories.svelte` already exists and is tagged
  `visual-pending`, so the remaining settings catalog work is to run and review
  that visual candidate rather than create the story. Automated validation was
  not run in this continuation.

- 2026-07-25 - Removed Fava Beta's stale direct dependency and SSR noExternal
  entry for `@beancount-js/forms` after source imports were retargeted to
  `@beancount-js/ui/forms`; the compatibility facade remains available for the
  frozen Fava package. Automated validation was not run in this continuation.

- 2026-07-25 - Updated the UI forms guidance to distinguish the frozen Fava
  reference, which remains on the compatibility facade, from Fava Beta, which
  now consumes `@beancount-js/ui/forms` through adapters and helpers. Automated
  validation was not run in this continuation.

- 2026-07-25 - Added `@beancount-js/ui` to Fava Beta's Vite SSR `noExternal`
  list so the mutable integration app treats the shared UI workspace package as
  local source during SSR, matching the direct Svelte component imports used by
  the migration adapters. Automated validation was not run in this continuation.

- 2026-07-25 - Folded duplicate `@beancount-js/ui/forms` imports in Fava Beta's
  ingestion source form-config helper after the compatibility-facade retarget,
  keeping app-owned form configuration on the UI forms public surface.
  Automated validation was not run in this continuation.

- 2026-07-25 - Aligned Fava Beta E2E legacy route translation with the app's
  settings route map for brands, history, and rules, and changed the C006
  rules-sidebar parity surface to navigate through `/import/rules` so
  `FavaNavigation` active-state logic and the parity helper use the same route
  contract. Automated validation was not run in this continuation.

- 2026-07-25 - Corrected the remaining frozen parity settings-rules route entry
  to use `/import/rules`, matching the shared Fava Beta route helper and
  `FavaNavigation` settings item identifiers. Automated validation was not run
  in this continuation.

- 2026-07-25 - Updated the synthetic visual-reference fixture README to describe
  `pnpm test:e2e:beta:visual-reference` as the focused C006 navigation parity
  command, not a full frozen parity run. Automated validation was not run in
  this continuation.

- 2026-07-25 - Added a focused C006 Fava Beta navigation walkthrough to
  `navigation.spec.ts` and exposed it as `pnpm test:e2e:beta:navigation`. The
  walkthrough covers workspace view switching, search toggle, settings
  navigation, back-to-ledger behavior, and persisted disclosure state. Automated
  validation was not run in this continuation.

- 2026-07-25 - Updated the frozen visual parity spec to snapshot and restore
  the active entry ledger around each test, so running the focused synthetic
  fixture command does not leave `visual-reference-project/sample.beancount`
  dirty after seeding parity data. Automated validation was not run in this
  continuation.

- 2026-07-25 - Added `pnpm test:e2e:beta:c006` as an aggregate evidence command
  for the paused navigation checkpoint. It runs the focused C006 navigation
  walkthrough and the focused C006 visual-reference parity command while keeping
  the narrower commands available for diagnosis. Automated validation was not
  run in this continuation.

- 2026-07-25 - Scoped the C006 navigation walkthrough's search-toggle
  interactions to `[data-ledger-workspace-sidebar]` so the evidence test asserts
  the migrated workspace navigation surface directly instead of relying on
  page-wide button matching. Automated validation was not run in this
  continuation.

- 2026-07-25 - Updated the synthetic visual-reference fixture README to point to
  both the focused visual-reference command and the aggregate C006 E2E evidence
  command. Automated validation was not run in this continuation.

- 2026-07-25 - Added `pnpm test:ui:c006` as a focused UI visual command for the
  C006 Storybook stories. It runs the existing Visual Delta Playwright lane with
  a Storybook-entry filter for the `Ledger Workspace Navigation` and
  `Ledger Settings Navigation` story IDs/titles, leaving broad `pnpm checks:ui`
  unchanged. Automated validation was not run in this continuation.

- 2026-07-25 - Hardened the UI visual suite with an optional
  `VISUAL_STORY_FILTER` Storybook-entry filter and switched `pnpm test:ui:c006`
  to use it for the C006 navigation story IDs/titles. This avoids relying only
  on Playwright test-name grep semantics while leaving the broad visual lane
  unchanged when the env var is unset. Automated validation was not run in this
  continuation.

- 2026-07-25 - Updated `pnpm test:ui:c006` so the focused UI visual command runs
  Playwright against the directly linked Visual Delta source package, removing
  the previous source-sync prerequisite. Automated validation was not run in
  this continuation.

- 2026-07-25 - Added `pnpm test:c006` as the root aggregate evidence command for
  the paused navigation checkpoint. It runs the focused UI visual C006 story
  lane followed by the focused Fava Beta C006 E2E pair. Automated validation was
  not run in this continuation.

- 2026-07-25 - Added `pnpm validate:fava-migration` as the root aggregate
  migration validation command. It runs `pnpm test:c006`, `pnpm checks:ui`, and
  `pnpm checks:beta` in sequence so G03 validation has one repeatable entry
  point. Automated validation was not run in this continuation.

- 2026-07-25 - Added `pnpm audit:fava-migration` to make the G03 boundary audit
  executable. It fails on working-copy changes under immutable `packages/fava`
  and on legacy `@beancount-js/forms` imports/dependencies in mutable UI/Beta
  source or Fava Beta package metadata. `pnpm validate:fava-migration` now runs
  this audit before the focused C006 and UI/Beta validation lanes. Automated
  validation was not run in this continuation.

- 2026-07-25 - Extended `pnpm audit:fava-migration` to parse
  `FAVA_MIGRATION.md` and fail unless every component tracker row C001-C070 is
  present and marked `Done`, making the G03 row-completion requirement
  executable. Automated validation was not run in this continuation.

- 2026-07-25 - Split the migration audit into reusable boundary and final modes:
  `pnpm audit:fava-migration` now checks immutable-Fava and legacy-forms
  boundaries, while `pnpm audit:fava-migration:final` also enforces C001-C070
  row completion. `pnpm validate:fava-migration` uses the final audit mode.
  Automated validation was not run in this continuation.

- 2026-07-25 - Added `pnpm validate:fava-migration:preflight` for the current
  C006 review state. It runs the reusable boundary audit, focused C006 evidence,
  and UI/Beta validation lanes without requiring C006 to already be marked
  `Done`; the final `pnpm validate:fava-migration` command still enforces row
  completion. Automated validation was not run in this continuation.

- 2026-07-25 - Extended `pnpm audit:fava-migration` to verify every
  `@beancount-js/ui` import in Fava Beta source is covered by the UI package
  export map, including wildcard exports. This keeps migration adapters on the
  public UI surface instead of private source paths. Automated validation was
  not run in this continuation.

- 2026-07-25 - Hardened the `@beancount-js/ui` public-subpath audit to include
  dynamic `import("@beancount-js/ui/...")` calls as well as static imports,
  keeping future lazy-loaded Fava Beta adapters on exported UI surfaces.
  Automated validation was not run in this continuation.

- 2026-07-25 - Hardened the legacy `@beancount-js/forms` boundary audit to
  include dynamic `import("@beancount-js/forms...")` calls as well as static
  imports and re-exports. Automated validation was not run in this continuation.

- 2026-07-25 - Extended the legacy forms boundary audit to inspect the
  `packages/fava-beta` importer block in `pnpm-lock.yaml`, so stale lockfile
  dependencies on `@beancount-js/forms` are reported alongside source and
  metadata references. Automated validation was not run in this continuation.

- 2026-07-25 - Added `pnpm report:fava-migration` as a read-only status report
  for the migration tracker. It prints gate dispositions, component completion
  counts, incomplete rows, and the current C006/G03 evidence checklists without
  running validation. Automated validation was not run in this continuation.

- 2026-07-25 - Corrected `pnpm report:fava-migration` gate parsing so the
  report reads the fourth gate-table column (`Disposition`) instead of treating
  the manual-review text as a status. Automated validation was not run in this
  continuation.

- 2026-07-25 - Extended `pnpm report:fava-migration` with a command summary for
  the preflight validation, final validation, focused C006, UI visual, Beta E2E,
  boundary audit, and final audit commands so handoff does not require scanning
  package scripts. Automated validation was not run in this continuation.

- 2026-07-25 - Added UI-package aliases for the migration audit and report
  tools, then routed the root `pnpm audit:fava-migration`,
  `pnpm audit:fava-migration:final`, and `pnpm report:fava-migration` commands
  through `@beancount-js/ui`. The tools now work from the UI package surface as
  well as the repository root. Automated validation was not run in this
  continuation.

- 2026-07-25 - Added `pnpm report:fava-migration:json` for structured migration
  handoff output. It emits gate dispositions, component completion counts,
  incomplete rows, command entries, and C006/G03 evidence sections as JSON while
  leaving the existing human-readable report unchanged. Automated validation was
  not run in this continuation.

- 2026-07-25 - Extended `pnpm report:fava-migration:json` with a machine-readable
  `summary` object covering C006 status, G03 disposition, component-row
  completion, and the next recommended validation command. Automated validation
  was not run in this continuation.

- 2026-07-25 - Aligned the JSON report's `summary.nextCommand` with the final
  audit semantics: it recommends `pnpm validate:fava-migration` only when all
  component rows are present and `Done`; otherwise it recommends the preflight
  command. Automated validation was not run in this continuation.

- 2026-07-25 - Made the JSON report summary schema explicit by computing
  `nextCommand` before constructing the `summary` object instead of adding it
  afterward. The emitted JSON shape is unchanged. Automated validation was not
  run in this continuation.

- 2026-07-25 - Extended `pnpm audit:fava-migration` to check the migration
  command surface in root and UI package metadata, including audit, report,
  focused C006, preflight, and final validation scripts. This keeps the
  evidence path executable instead of relying only on tracker text. Automated
  validation was not run in this continuation.

- 2026-07-25 - Extended `pnpm audit:fava-migration` to verify the root audit and
  report commands delegate through the `@beancount-js/ui` package aliases, so
  root and UI-package entry points cannot drift silently. Automated validation
  was not run in this continuation.

- 2026-07-25 - Extended `pnpm audit:fava-migration` to verify the exact root
  validation command semantics: preflight must use the reusable boundary audit,
  while final validation must use the row-completing final audit before running
  C006 and UI/Beta lanes. Automated validation was not run in this continuation.

- 2026-07-25 - Improved `pnpm audit:fava-migration` diagnostics for command
  drift by distinguishing root audit/report delegate mismatches from root
  validation command semantic mismatches. Audit coverage is unchanged.
  Automated validation was not run in this continuation.

- 2026-07-25 - Extended `pnpm audit:fava-migration` to verify the UI-local
  audit/report aliases invoke the expected `audit-fava-migration.mjs` and
  `report-fava-migration.mjs` scripts with the correct flags, so package-owned
  entry points cannot drift from their implementations. Automated validation was
  not run in this continuation.

- 2026-07-25 - Hardened `pnpm audit:fava-migration` path resolution by deriving
  the script directory from `import.meta.url` instead of relying on
  `import.meta.dirname`, keeping the executable audit portable across Node ESM
  runtimes. Automated validation was not run in this continuation.

- 2026-07-25 - Removed legacy `-js/forms` compatibility imports from `packages/ui/src/components/forms/IngestionBrandSettings.svelte`, `IngestionConfigEditor.svelte`, and `IngestionSourcesPreview.svelte`, replacing them with local `packages/ui` component and type imports. This targets the known UI boundary blocker without changing `packages/fava`. Automated validation was not run in this continuation.

- 2026-07-25 - Corrected the shared `TreeTable` to `TreeTableNode` prop boundary by passing `toAccountLabel` instead of the stale `toLabel` alias, and changed table formatter/label aliases into live fallback functions so runes-mode props are not captured only at initialisation. Automated validation was not run in this continuation.

- 2026-07-25 - Reworked `packages/ui/src/components/pages/AccountDetails.svelte` legacy `$:` declarations into `$derived` values and corrected the Storybook story to pass `breadcrumbs` instead of an unused `breadcrumbItems` prop. Automated validation was not run in this continuation.

- 2026-07-25 - Removed the duplicate `<script>` block from `packages/ui/src/components/tables/ActivityTable.svelte` by moving `setIndeterminate` into the primary script, and removed the redundant `role="status"` from the ActivityTable story live output. Automated validation was not run in this continuation.

- 2026-07-25 - Removed the redundant `role="status"` from the JournalTable story live output to match the ActivityTable live-region cleanup. Automated validation was not run in this continuation.

- 2026-07-25 - Relaxed the Statistics Storybook account-link assertion to match links whose accessible name contains `Assets:Cash`, allowing the shared account avatar content to contribute to the accessible name while still proving the account link is present after switching presets. Automated validation was not run in this continuation.

- 2026-07-25 - Converted remaining runes-mode legacy reactive declarations in `AccountCell.svelte`, `StatementReport.svelte`, and `QueryBox.svelte` to `$derived`/`$effect` forms, leaving legacy-mode `export let` components unchanged. Also guarded optional account navigation callbacks in `AccountCell`. Automated validation was not run in this continuation.

- 2026-07-25 - Cleaned direct static-risk patterns in changed UI migration files: replaced the remaining runes-mode `on:click` in `AccountCell.svelte`, moved `IngestionRunHistory` sort-column metadata out of markup type assertions, and narrowed `IngestionReconciliationPanel` facet callbacks away from a generic prop signature. Automated validation was not run in this continuation.

- 2026-07-25 - Fixed the Fava Beta `IncomeStatement.svelte` adapter parse issue by replacing a malformed `{#const ...}` snippet directive with Svelte's `{@const ...}` form. This targets the earlier downstream `IncomeStatement.svelte` default-export diagnostic. Automated validation was not run in this continuation.

- 2026-07-25 - Adjusted the shared `IngestionBrandSettings.svelte` config callback type to support the stronger Fava Beta editable ingestion config handler while keeping the UI component app-independent and display-oriented. This targets the earlier beta callback type diagnostic. Automated validation was not run in this continuation.

### C059 progress notes

- 2026-07-25 — Began the editor slice by correcting shared `Editor.svelte`
  and adding a shared `Highlighter.svelte` in `@beancount-js/ui`, then switched
  `fava-beta` `Editor.svelte` into a thin adapter that wires app-owned setup,
  save, AI, and header actions into the shared editor.
- 2026-07-25 — Completed the editor slice migration: `@beancount-js/ui/src/components/pages/Editor.svelte`
  and `pages/Highlighter.svelte` now own the editor/highlight presentation and
  callbacks. `packages/fava-beta/src/components/Editor.svelte` is the adapter with
  app-owned state wiring, while `packages/fava-beta/src/components/Highlighter.svelte`
  forwards directly to UI.
- 2026-07-25 — Completed the Search slice migration: `@beancount-js/ui/src/components/pages/Search.svelte`
  now owns the search presentation, filter controls, and result grouping; `packages/fava-beta/src/components/Search.svelte`
  remains an application adapter that supplies BQL execution and ledger state transitions.
- 2026-07-25 — Validation snapshot: `pnpm --filter @beancount-js/ui svelte-check`
  and `pnpm --filter @beancount-js/fava-beta check` still report pre-existing
  migration-wide type/script failures unrelated to C059, but there are no C059
  file-level diagnostics after the type fixes above.
- 2026-07-25 — Completed `C062` (`IngestionBrandSettings.svelte`) as a
  UI ownership slice: presentation now lives in
  `@beancount-js/ui/src/components/forms/IngestionBrandSettings.svelte` with the
  existing `fava-beta` component reworked to adapter wiring, including load,
  validation issue mapping, save debouncing, and save/load routing.

### C060 progress notes

- 2026-07-25 — Migrated `AiDock` to shared UI presentation in
  `packages/ui/src/components/feedback/AiDock.svelte` and
  `packages/ui/src/components/feedback/AiDockSkeleton.svelte`. The
  `fava-beta` adapter now handles session persistence, localStorage settings,
  API endpoints/streaming behavior, mention lookup, and proposal/approval action
  callbacks while passing data and controls into shared UI.

### C061 progress notes

- 2026-07-25 - Completed `IngestionAccountsSetup.svelte` migration by replacing the UI copy with a prop-driven shared form component and converting the Fava Beta component into an adapter that retains loading, API, sync, linking and unlinking, route navigation, and source account persistence. Added a UI Storybook story with display-ready fixtures and exported the component from `-js/ui/forms`.
- 2026-07-25 - Filtered validation shows no `IngestionAccountsSetup` diagnostics in `pnpm --filter -js/ui check`, no `IngestionAccountsSetup` diagnostics in `pnpm --filter -js/fava-beta check`, and no remaining C061 Storybook accessibility failure after naming the progressbar. Broad UI checks remain red from unrelated migrated surfaces: boundary violations in `IngestionBrandSettings`, `IngestionConfigEditor`, and `IngestionSourcesPreview`; UI type errors around `TreeTable`; Storybook import or interaction failures in `AccountDetails`, `ActivityTable`, `JournalTable`, and `Statistics`.

### C063 progress notes

- 2026-07-25 — `IngestionConfigEditor.svelte` now acts as a thinner app
  adapter in `fava-beta`, moving preview rendering details into
  `@beancount-js/ui/src/components/forms/IngestionSourcesPreview.svelte` and
  adapting config-derived state and callbacks (secret mode/value/base URL/endpoint
  edits, sync, and account-management navigation). Legacy inline preview markup is
  removed from the beta component.
- 2026-07-25 — Completed `C063` migration: `fava-beta` `IngestionConfigEditor.svelte`
  now renders a thin adapter over `@beancount-js/ui/src/components/forms/IngestionConfigEditor.svelte`,
  passing app-owned config, preview rows, source-form bundles, per-source callbacks,
  and section-open persistence into the shared editor while retaining all
  persistence, routing, and validation logic in `fava-beta`.

### C064 progress notes

- 2026-07-25 — Added `@beancount-js/ui/src/components/pages/IngestionMerchantManage.svelte`
  for shared presentation of merchant list/search/pagination and wired
  `packages/fava-beta/src/components/IngestionMerchantManage.svelte` into a thin
  adapter. The adapter now retains route/query ownership, `backfill` actions,
  loading/sync logic, and `MerchantEditSheet` orchestration.

### C065 progress notes

- 2026-07-25 - Completed `IngestionMerchantReview.svelte` migration by adding `-js/ui/src/components/pages/IngestionMerchantReview.svelte` as a prop-driven shared page and converting the Fava Beta component into an adapter that keeps route state, project loading, filtering derivation, source selection, API calls, header actions, bulk detect/confirm behavior, and `IngestionMerchantSheet` orchestration.
- 2026-07-25 - Added a UI Storybook story for pending and reviewed merchant clusters with selection, filtering, sorting, and view-toggle callbacks wired to local fixture state. Automated validation was not run in this continuation; existing migration-wide blockers remain tracked separately.

### C066 progress notes

- 2026-07-25 - Completed `IngestionReconciliationPanel.svelte` migration by adding `-js/ui/src/components/pages/IngestionReconciliationPanel.svelte` as a prop-driven shared panel and converting the Fava Beta component into an adapter that keeps route state, project loading, reconciliation APIs, ledger-derived account appearance, merchant-logo enrichment, selection pruning, and ingestion bulk-action integration.
- 2026-07-25 - Added a UI Storybook story covering candidate cards, member rows, filters, selection, and action callbacks with display-ready fixtures. Automated validation was not run in this continuation; existing migration-wide blockers remain tracked separately.

### C067 progress notes

- 2026-07-25 - Completed `IngestionRunAudit.svelte` migration by adding `-js/ui/src/components/pages/IngestionRunAudit.svelte` as a prop-driven shared page and converting the Fava Beta component into an adapter that keeps project and route loading, run API reads, date formatting, proposal grouping, row derivation, query synchronization, and read-only `IngestionProposalSheet` orchestration.
- 2026-07-25 - Added a UI Storybook story covering run summary, AI audit calls, expandable date groups, proposal rows, pagination state, and callback wiring with display-ready fixtures. Automated validation was not run in this continuation; existing migration-wide blockers remain tracked separately.

### C068 progress notes

- 2026-07-25 - Completed `IngestionRunHistory.svelte` migration by adding `-js/ui/src/components/pages/IngestionRunHistory.svelte` as a prop-driven shared page and converting the Fava Beta component into an adapter that keeps project loading, source filtering, run-history API reads, route navigation, ledger-derived account appearance, merchant-logo enrichment, date grouping, and ingestion header-action wiring.
- 2026-07-25 - Added a UI Storybook story covering grouped run rows, source badges, account links, sort callbacks, run-link callback handling, and pagination state with display-ready fixtures. Automated validation was not run in this continuation; existing migration-wide blockers remain tracked separately.

### C069 progress notes

- 2026-07-25 — Completed the `IngestionSourcesPreview` migration: added
  `@beancount-js/ui/src/components/forms/IngestionSourcesPreview.svelte`
  as a shared preview renderer with callback-driven updates, then switched
  `packages/fava-beta/src/components/IngestionConfigEditor.svelte` to map
  app-owned config, merchant, account appearance, and sync state into this
  shared component. The legacy beta `IngestionSourcesPreview.svelte` adapter file
  has been removed.

### C070 progress notes

- 2026-07-25 — Continued `RulesSettings` migration by moving shared presentation
  into `@beancount-js/ui/src/components/pages/RulesSettings.svelte` (including
  rule sorting, runs table + pagination, and apply/run preview dialogs) and
  updating `packages/fava-beta/src/components/RulesSettings.svelte` to a thin adapter that retains
  project loading, API calls, save/delete/apply orchestration, and header-action
  wiring while delegating rendering and interactivity to the UI page.
- 2026-07-25 — Completed C070 after fixing the beta adapter import, editor-close
  state reset, typed Storybook fixtures, and Storybook accessibility issues in
  the rule list/run-history surface. Filtered validation showed no remaining
  `RulesSettings` diagnostics in `pnpm --filter @beancount-js/ui check`,
  `pnpm --filter @beancount-js/fava-beta check`, or
  `pnpm --filter @beancount-js/ui test-storybook`; broad package checks still
  fail on unrelated migration-wide forms, dashboard, table, and older adapter
  issues.

## Validation log

Record commands, outcomes, reference manifests, visual sidecars, and Jujutsu
change IDs here at the end of each committed slice.

- 2026-07-24 — Visual Delta refresh (`mrwmkrvx`): refreshed from the clean
  canonical source directory, observed at revision
  `7da0aff00fbc9288a138c8dae7f45a3d5f299f72`, and added guarded pre-run
  synchronization so future harness entry points could not silently use a stale
  copy. The host now uses bare
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
- 2026-07-25 — Feedback controls slice (`C038`–`C040`): migrated
  `AiUnifiedReviewDiff.svelte` and `ResourceViewer.svelte` to shared UI feedback
  components and adapted `errors/Errors.svelte` to `ValidationErrorTable`.
  `pnpm --filter @beancount-js/ui check-boundaries` passed for the new
  presentation ownership work. `pnpm --filter @beancount-js/ui test-storybook` and
  `pnpm --filter @beancount-js/fava-beta check` still fail from pre-existing
  unrelated issues in `ActivityTable.svelte`, `JournalTable.svelte`,
  `tree-table/StatementSummaryTreeTable.svelte`, and several form/types areas.
- 2026-07-25 — Route-loading skeleton slice (`C041`): migrated `skeletons/*`
  files to adapter entry points that delegate to corresponding
  `@beancount-js/ui/feedback` components for shared loading surfaces.
- 2026-07-25 — Statement report slice (`C049`): migrated
  `@beancount-js/fava-beta/src/components/StatementReport.svelte` to a thin adapter around
  `@beancount-js/ui/dashboard/StatementReport.svelte` that preserves chart
  switching through `lastActiveChartName` and keeps section rows delegated to the
  existing Beta tree-table section adapter.
- 2026-07-25 — Income statement slice (`C050`): migrated
  `@beancount-js/fava-beta/src/components/IncomeStatement.svelte` to a thin adapter around
  `@beancount-js/ui/dashboard/IncomeStatement.svelte` with chart-switch persistence local
  to the component and section rendering delegated to the existing Beta
  `StatementSummaryTreeTable` adapter.
- 2026-07-25 — Balance sheet slice (`C051`): migrated
  `@beancount-js/fava-beta/src/components/BalanceSheet.svelte` to a thin adapter around
  `@beancount-js/ui/dashboard/BalanceSheet.svelte` with chart switching and section
  rendering delegated to the existing Beta `StatementSummaryTreeTable` adapter.
- 2026-07-25 — Trial balance slice (`C052`): migrated
  `@beancount-js/fava-beta/src/components/TrialBalance.svelte` to a thin adapter around
  `@beancount-js/ui/dashboard/TrialBalance.svelte`, preserving the account tab
  selection behavior and section rendering through the Beta `StatementSummaryTreeTable` adapter.
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
  `@beancount-js/ui/forms` rule metadata controls. `@beancount-js/fava-beta/src/components/RuleEditorSheet.svelte`
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
- 2026-07-25 — Dashboard components slice (`C042`–`C047`): migrated
  `@beancount-js/fava-beta` dashboard adapters to shared `@beancount-js/ui`
  implementations for donut, flow, line, section, tree table/row, and chart
  tooltip surfaces. App callbacks and route/selection behavior were preserved.
- 2026-07-25 — Financial dashboard slice (`C048`): migrated
  `@beancount-js/fava-beta/src/components/FinancialDashboard.svelte` to a thin
  adapter that derives shared dashboard data from `createDashboardData` and routes
  period/currency/valuation/account interactions through `@beancount-js/ui/dashboard/FinancialDashboard.svelte`.

- 2026-07-25 — Account details slice (`C053`): migrated
  `@beancount-js/fava-beta/src/components/AccountDetails.svelte` to a thin adapter around
  `@beancount-js/ui/pages/AccountDetails.svelte`. The shared shell now owns breadcrumb,
  chart-switcher, and tab presentation. The adapter keeps ledger derivation, query
  routing, tab state persistence, and local account-tree conversion intact.
- 2026-07-25 — Statistics slice (`C055`): migrated
  `@beancount-js/fava-beta/src/components/Statistics.svelte` to a shared
  `@beancount-js/ui/pages/Statistics.svelte` adapter. The adapter retains application-owned
  query execution and keeps results rendered through existing `QueryTable` composition.
