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

- Before adding or changing an editable form, read the canonical form contract at `packages/forms/FORMS.md` (origin: `~/code/cv/spec/src/30-domain-contracts/forms-and-shared-ui.md`).
- Treat that contract as the implementation standard for this repository. If this repository needs a new form pattern, extend `@beancount-js/forms` first; do not create a Fava-local row, section-header, disclosure, or separator layout.
- Use the shared form primitives for editable fields and sections. Forms use one `max-content minmax(0, 1fr)` label/value grid per scope, visible single separators, title-only collapsible section headers, and a left-rail disclosure control. Content inside a collapsible section is indented; the header itself is not.
- Keep every labelled field inside one `beancount-structured-form` scope per section. Do not place a `FormField` outside that grid next to sibling stacks — label columns will drift.
- For `FilterCommandPicker`, date pickers, switches, and other pill/button controls: always `FormField as="div" align="center"`. Default `align="start"` is for borderless text inputs/`output` only; pills otherwise sit flush on the row separator and labels look vertically off.
- When a form mixes text inputs with pill controls, use `align="center"` on the text rows too so vertical rhythm matches.
- Do not add explanatory text to form section headers. Keep labels and values on the same row at desktop widths. Use a shadcn-Svelte `Switch` for every boolean configuration and YAML mode; in catalog/migrated forms use `@beancount-js/ui/forms/Switch.svelte` inside `FormField as="div" align="center"`, never an `aria-pressed` Enabled/Disabled button. Fava's existing local Switch remains supported during the migration.
- Use `SegmentedControl` only for two or three named, mutually exclusive non-boolean choices. A boolean is always a Switch.
- A form toolbar owns collapse/expand-all. Verify title-click collapse, collapsible content indentation, nested collapse state where applicable, no duplicate borders, and no initial desktop horizontal overflow in browser coverage.

## Searchable pickers

- Default to `FilterCommandPicker` from `@beancount-js/forms` for any searchable select (accounts, queries, facets, env var names, enum-like choices). Use `fullWidth` in forms and sidebars.
- In forms, wrap every `FilterCommandPicker` with `FormField as="div" align="center"` (see Shared forms). Never nest the picker in a label-only `FormField`.
- For values the user may type that are not in the option list (e.g. Environment credential names from project `.env`), set `allowCustom={true}` on `FilterCommandPicker`. Do not use `SearchableChoicePicker` for new work — it is the legacy picker.
- Multi-select: `multiple` + `values` + `onValuesChange`. Single-select: `value` + `onChange`.

## UI catalog and Storybook

- `@beancount-js/ui` owns the shared visual foundation and Storybook catalog. Keep stories next to the component they document. During the forms migration, Stories in `packages/forms/src` are intentionally discovered by the UI catalog.
- The `Shadcn/` Storybook section documents Fava's local shadcn-svelte source in place. Keep those stories colocated in `packages/fava/src/lib/components/ui`; do not move or re-export a Fava component solely for catalog coverage. Promote only deliberate cross-app primitives into `@beancount-js/ui`.
- `UI Forms/Guidance` is the canonical high-level form decision guide. Generated Docs pages retain props and examples; every reusable form component must link back to the guide and update it whenever its usage rules change.
- During Stage 2, classify every `@beancount-js/forms` visual export in `packages/forms/STAGE2_AUDIT.md`. Add a colocated story and Docs description before treating it as catalogued; only deliberate cross-app primitives belong in `@beancount-js/ui`.
- Every reusable component must have stories covering its meaningful visual states, variants, and error/empty states. Treat the stories as the canonical visual contract for agents and application code.
- Interactive controls must be interactive in their stories. Keep the story's state locally, pass it back through callbacks such as `onChange` or `onValuesChange`, and render the selected or changed value in the preview. Do not use static args for a control whose primary behavior is user interaction.
- Storybook accessibility checks are required: `@beancount-js/ui` runs axe with `a11y.test = "error"`, so any accessibility violation fails the browser test. Fix violations; do not disable or waive axe rules to make a story pass.
- For every change to `packages/ui`, a colocated story, or a component exposed in Storybook, run `pnpm --filter @beancount-js/ui checks`. This runs formatting, Svelte diagnostics with warnings treated as errors, Storybook Chromium/a11y tests, and the static Storybook build.
