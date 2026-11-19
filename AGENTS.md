# Beancount JS Studio Agent Guide

## Workflow

- When `jj` is installed, using the global `jj-jujutsu` skill is mandatory for every change in this repository. Load and follow the skill before making changes, and use `jj` for all status, diff, commit, history, bookmark, workspace, and remote operations. Do not use Git write commands or mix Git write operations into a `jj` workflow.
- Before editing, inspect the working copy with `jj --no-pager st` and `jj --no-pager diff --summary`. Preserve unrelated work and keep it out of the requested change.
- Make changes in small, independently reviewable batches. Each batch should represent one logical change, avoid unrelated cleanup, and be small enough to validate and diagnose on its own.
- Work in verified slices: implement one slice, run its relevant checks, inspect its diff, and commit it with `jj commit` before starting the next slice. A validated slice must always be committed; do not accumulate several finished slices in `@` or wait until handoff to make one large commit.
- Do not leave completed work only in the working-copy commit `@` unless the user explicitly asks for uncommitted changes. Before handoff, verify that every finished slice is committed and that `@` contains no unintended changes.
- Keep commits scoped. Do not include unrelated working-copy changes in a slice commit.
- Write PR-quality commit messages: imperative summary, clear scope, and enough context for review.

## Validation

- Every code change must run targeted automated tests for each touched package. Use the narrowest useful test command while iterating, then run the package's complete relevant test command before committing the slice.
- If a change crosses package or module boundaries, changes shared code consumed by an app, or touches multiple modules in an app, run the full test suite for the affected app before committing. Use the root test suite when the affected behavior spans multiple packages or apps.
- Run any additional checks implied by the change, such as type checking, linting, formatting verification, build checks, or browser/end-to-end coverage. Tests do not replace these checks when they are relevant.
- After the final code edit, run at least one relevant automated test before handoff, even if tests passed earlier in the task. Never hand off code that has not been tested in its final state.
- Treat a failing check as unfinished work: fix it and rerun the check, or clearly report the pre-existing or external blocker. Never silently skip, ignore, or claim success for a failing validation.
- Documentation-only or configuration-only changes that cannot exercise runtime behavior still require a relevant validation, such as formatting, parsing, schema validation, or another focused consistency check. Record the command run for handoff.
- At handoff, report the validations run and their outcomes, along with the committed `jj` change or changes.

## Specification workflow

- The canonical product requirements live under `spec/src`. Using the global
  `spec-validator` skill is mandatory when editing those files, changing
  protected product behavior, or diagnosing a specification check.
- Before manually scanning implementation files, run
  `pnpm spec:search "<topic or requirement ID>"`, then open the canonical hit.
- Update the owning requirement and its verification evidence in the same
  change as protected behavior. Tests do not replace this specification update.
- Run `pnpm spec:first` while iterating and `pnpm spec:check` before committing.
  Root `pnpm checks` runs the specification gate before functional checks.

## Application baseline and direction

- The active application/UI baseline is `packages/ui` / `@beancount-js/ui`,
  integrated from the Design Core historical workspace. Continue new work in
  this main checkout on the `beancount-studio` development line.
- Read `spec/src/app-baseline.md` for package/host ownership and
  `docs/APP_STATUS.md` for qualification and remaining work. Keep README files,
  these specifications and agent guidance aligned when direction changes.
- The old extraction/native-CSS/Visual Delta campaign is superseded. Its
  previous state, including pending work, is preserved at
  `archive/pre-design-core-baseline-2026-10-28`. Do not restart its component
  queue or treat historical certification statuses as current approval.
- `pnpm dev` / `pnpm storybook` start the sole active catalog. Application
  stories use disposable in-memory data sources. `pnpm dev:app` starts the
  executable `packages/app` host, which integrates the active UI through
  `BeancountDataSource` with filesystem/API and browser-workspace adapters.
  Keep presentation in `packages/ui`; keep host runtime and capability wiring
  in `packages/app`.
- Use published `@lapismd/design-core` shell, forms and primitives. Keep
  controller state/actions, history, cancellation, service/cache lifetimes and
  host capability boundaries explicit and isolated per instance/project.
- The active app ships no AI component, provider route, MCP process, ingestion
  enrichment action or AI rule executor. Do not reconnect the dormant shared
  executor contracts implicitly. A future integration must remain host-owned
  and enter through the optional details snippet and provider-neutral
  `BeancountDataSource.request` boundary.
- Run `pnpm check:baseline` for ownership/configuration checks and
  `pnpm checks:ui` for every active UI slice. Root `pnpm checks` includes the
  specification gate, active UI, application host and current package graph.
  Report pre-existing aggregate failures separately and never disable checks to
  promote a baseline.
- Run `pnpm --filter @beancount-js/app checks` for host changes. This includes
  static OPFS save/reload acceptance. Passing host route/persistence/build checks
  does not qualify external bank credentials.

## Shared forms and searchable pickers

- `BC-APP-004` in `spec/src/application-ui.md` is the canonical form behavior
  contract. `packages/ui/FORMS.md` is its implementation guide. Implement it
  with public Design Core forms and application controls in `@beancount-js/ui/forms`.
- Keep one `max-content minmax(0, 1fr)` label/value grid per form scope, visible
  single separators, title-only collapsible headers and left-rail disclosure.
- Use `FormField as="div" align="center"` for pill/button controls, date pickers
  and searchable pickers in row layouts. Use centered alignment for text rows
  mixed with pills. Do not add explanatory section-header text.
- Use `FilterCommandPicker` from `@beancount-js/ui/forms`; use `fullWidth` in
  forms/sidebars, `allowCustom` for typed values, and the existing single- or
  multi-select action contracts. Do not add new `SearchableChoicePicker` uses.
- Form toolbars own collapse/expand-all. Check nested collapse and horizontal
  overflow. Inline editor widgets remain compact document affordances rather
  than structured form rows.

## Retired applications and frozen references

- `packages/fava`, `packages/fava-beta`, `packages/ui-legacy` and
  `packages/forms` are retired and must not be restored as parallel application
  or compatibility paths. Their history remains available through Jujutsu.
- Consume no historical reference source in the active UI. Validate provenance
  against the commits recorded in `UI_PROVENANCE.json` and
  `CATALOG_INVENTORY.json`; those paths do not require current Fava files.
- Keep reference fixture snapshots under
  `packages/ui/catalog/fixtures/reference` and out of mutation/seed helpers.
- Shell/table/editor qualification uses browser geometry and accessibility
  checks. Human visual approval and production backend readiness must be
  reported separately; do not claim either from passing catalog tests.
