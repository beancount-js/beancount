# Stage 3 Fava catalog inventory

Stage 3 expands Storybook coverage without changing application ownership. Fava remains the implementation owner for its application components; the UI package continues to own only deliberately cross-application primitives.

## Already catalogued

| Surface                                 | Catalog location                      | Boundary                                                    |
| --------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| Shared form primitives and form runtime | `packages/forms/src`                  | Stage 2 visual contract; no import migration in this stage  |
| Fava-local shadcn-svelte source         | `packages/fava/src/lib/components/ui` | Editable Fava-local source rendered under the shared tokens |
| Shared app-shell composition            | `packages/ui/src/components/layout`   | Cross-app shell primitive                                   |

## Fava application components to catalogue

Stories stay colocated with the Fava source and use deterministic local fixtures. A component is catalogued only when its Docs page explains its purpose and its stories exercise the meaningful interactive, empty, or error states.

| Area                             | Components                                                                                                      | Stage 3 decision                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compact selection and navigation | `ContentScrollArea`, `CycleSelect`, `ComboBox`, `PagePagination`                                                | Catalogued: reusable, fixture-free building blocks                                                                                                                                                                                                          |
| Studio shell                     | `StudioShellHeader`, `StudioShell`, `FavaNavigation`                                                            | Catalogued with fixture-backed workspace and in-memory routing contexts                                                                                                                                                                                     |
| Tables                           | `DataTable`, `ActivityTable`, `JournalTable`, `QueryTable`, `ImportTable`, `IngestionTable`, and `tree-table/*` | Generic, BQL-query, grouped-activity, journal-wrapper, statement-summary, legacy-import, ingestion-review, and single/multi-period account-tree tables catalogued; catalogue each remaining distinct domain interaction with representative ledger fixtures |
| Selected-record actions          | `AccountBulkActionSheet`                                                                                        | Catalogued with its real account-replacement and duplicate-action sections                                                                                                                                                                                  |
| Dashboard and chart composition  | `Chart`, `ChartSwitcher`, `ModeSwitch`, `dashboard/*`, `FinancialDashboard`                                     | Chart types, mode and legend selection, chart-perspective switching, net worth, outflow, flow, empty states, and the composed dashboard are catalogued                                                                                                      |
| Fava form adapters               | `form/AccountComboField`, `MerchantComboField`, `SecretField`, `SwitchField`                                    | Catalogued with stateful source fixtures, including Merchant Picker and its source-form adapter                                                                                                                                                             |
| Loading and feedback             | `skeletons/*`, `errors/Errors`, `Empty` compositions                                                            | Route/reconciliation and application-page skeleton gallery, plus the validation-error state, catalogued; add any materially different loading state                                                                                                         |

## Intentional exclusions

- SvelteKit routes and page orchestration are application integration surfaces, not reusable catalog components. Exercise them through end-to-end coverage.
- CodeMirror widgets and extensions are editor implementation details. `CodeEditor` and `YamlBackedForm` already provide the editable-source visual contract.
- Private shadcn subcomponents are represented by their public family stories in `Shadcn/`.

## Completion rule

Each in-scope component above has a colocated Storybook story and generated Docs description, with local reactive state and interaction coverage where applicable. The catalog shows the exact Fava source under the shared theme; it does not require a production code move or package removal.
