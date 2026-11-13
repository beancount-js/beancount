# Recorded Fava provenance review

## Current baseline

On 28 October 2026 this controller-backed Design Core catalog was adopted as
the active UI baseline in the main checkout. The previous extraction state is
preserved at `archive/pre-design-core-baseline-2026-10-28`. Read the
[application specification](../../spec/src/app-baseline.md) and
[current status](../../docs/APP_STATUS.md). The comparison details below record
historical source/review provenance; listed localhost ports describe how the
references were reviewed and do not imply a currently running server.

## Selected reference

The recorded comparison application is Fava at
`498bd075266922ab11cb4358f19aa6b9828e8539` (`Add UI query results table`),
selected for review on 21 October 2026. It was reviewed in the isolated
`../beancount-js-studio-query-table-498bd075` workspace. The localhost URLs in
this document are historical review evidence, not current application surfaces.

The adapted domain source originated at
`215bb59f31d4658410c2fd2b0122022a56dff5aa`; that provenance remains accurate.
Changing the comparison target does not replace the pinned Design Core shell,
controller ownership or dependency versions. Fava source is no longer present
in the current package graph.

`Beancount/Review/Matching preview` bundles five active-owned ledger snapshots.
Its entry is `sample.beancount`, and the Fava-derived snapshots live under
`catalog/fixtures/reference`. The dashboard uses **All time** and the live clock
for this comparison scenario (focused stories retain the fixed 2024 clock).
Original source paths and current targets are recorded in
`CATALOG_INVENTORY.json`; catalog validation compares every snapshot byte with
the selected Jujutsu commit. The synthetic review project and small fixtures
remain available for focused navigation and geometry tests.

## Query table recovery and related history

The newer renderer was not deleted from this historical workspace: the selected
pre-Storybook base precedes its introduction. Fava at `498bd075` already uses
the paged native table for Query, Holdings and Statistics.

The current UI recovers the reusable renderer from the parent of `66e56a4bf39f`
(before native CSS generation), with the later query adapter from
`4c5afac5e00e`. It consumes the pinned public Design Core Table and Select,
sorts the complete dataset before paging, and retains money/date/account
formatting, multiline values, charts and empty/error states. The generic legacy
account Grid remains virtualized. AccountNavigationLink now integrates the existing UI account avatar as well. Pinned Design Core 0.3.1 has no avatar export, so the
account-specific presentation is owned here; public Design Core Pagination
still owns page behavior. Merchant logo caches are isolated per controller.

The chosen Fava sample contains 30 existing validation diagnostics (including a
duplicate Starling open and an unopened Amex account). The comparison fixtures
preserve those source diagnostics; their report totals and Statistics rows
match the running reference.

Related changes reviewed:

| Change                         | Behavior                                                              | Current disposition                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `8da834629543`, `4219725f3888` | Query paging, page size and Holdings catalog surfaces                 | Recovered and covered by browser stories                                                                                                                      |
| `db2a05912f94`                 | Controlled SavedQueryHistory with reuse, delete and expansion         | Adapted QueryBox retains these core actions; extracting a separate reusable history component remains optional                                                |
| `73237ab3090e`, `d389c9ab660b` | Compact query editor, grouped actions and saved-query cards           | Recovered from the selected reference with syntax highlighting/completions and its formatter version; retains controller-owned history and keyboard execution |
| `bbaff0cb13bb`, `5da6729c7280` | AccountNavigationLink and interval account appearance                 | Recovered for consistent account avatars/appearance in query, statement, dashboard, interval and activity tables                                              |
| `ca97b2b00736`                 | Separate folder disclosure from selection and explicit file expansion | File disclosure is already independent and controller-owned; folder rows retain historical expansion semantics                                                |
| `ae05fa5ed25d`                 | Reusable PresetQueryView for Holdings and Statistics                  | Potential deduplication; both current routes already use the recovered shared query renderer                                                                  |
| `eded26e88466`                 | Shared interval account table                                         | Existing interval adaptation is covered for alignment, sticky columns and borders                                                                             |

## Qualification

The catalog inventory covers routes, navigation states and table families.
Browser assertions cover selected modes, project spacing/opening/history,
folder/tag trees, settings return/disclosures/search width, sorting, paging,
page size, multiline/empty/error results and desktop/mobile containment.
Preset-query initialization replaces current route state, so Back returns to
the originating report and Forward restores the selected query.
Geometry checks use 1 CSS pixel for column alignment and 2 pixels for sticky
columns. Statement/dashboard rows retain the 48px minimum; virtualized grid
rows retain their family-specific height rules.

Run the full gate from this package:

```sh
pnpm checks
pnpm exec node scripts/check-catalog.mjs --built
```

Manual comparisons use matching ledger paths and filters. The shared Design
Core shell and theme remain the intended integration surface; later reference
extractions listed above are not represented as completed migrations.
