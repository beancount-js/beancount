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

## Shared forms

- UI-package work has resumed. `packages/ui` / `@beancount-js/ui` is the
  canonical implementation and public surface for reusable presentation and
  form components.
- `packages/forms/FORMS.md` remains the active form behavior contract. Implement
  that contract in `@beancount-js/ui/forms`.
- `@beancount-js/forms` is a temporary implementation-free compatibility
  facade for the frozen Fava reference. Do not add source behavior, stories, or
  dependencies there.
- Keep one `max-content minmax(0, 1fr)` label/value grid per form scope, visible single separators, title-only collapsible headers, and left-rail disclosure.
- Use `FormField as="div" align="center"` for pill/button controls, date pickers, and searchable pickers in row layouts.
- Use centered alignment for text rows when they are mixed with pills.
- Do not add explanatory text to section headers. Use existing boolean controls in this repository for booleans.
- A form toolbar owns collapse/expand-all; keep nested collapse state and horizontal overflow checks in scope.

## Searchable pickers

- Use `FilterCommandPicker` from `@beancount-js/ui/forms` for searchable select controls.
- Wrap each picker in `FormField as="div" align="center"`, and use `fullWidth` in forms and sidebars.
- For user-entered values not present in options, use `allowCustom={true}`.
- Use `multiple` + `values` + `onValuesChange` for multi-select; use `value` + `onChange` for single-select.
- Do not use `SearchableChoicePicker` for new work.

## UI catalog and Storybook

- The resumed migration is tracked in `packages/ui/FAVA_MIGRATION.md`.
- `packages/fava` is the immutable comparison application. Migration commits
  must not edit it; protected captures run from the pinned `fava-reference`
  Jujutsu workspace.
- `packages/fava-beta` is the integration target once the harness and Forms
  foundation are complete. It may keep application adapters, routes, stores,
  ledger derivation, persistence, APIs, and CodeMirror integration; reusable
  presentation belongs in `packages/ui`.
- Run `pnpm --filter @beancount-js/ui checks` for every UI slice. UI and
  Fava Beta are intentionally excluded from the ordinary root `pnpm checks`
  aggregate while migration is in progress.
- Manual validation pauses occur only after the visual-reference harness, after
  the Forms consolidation, and after the final parity audit. Component slices
  use automated gates and do not wait for per-component approval.
