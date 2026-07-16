# Beancount JS Studio Agent Guide

## Workflow

- If the global `jj-jujutsu` skill is available, load and follow it for version control. Prefer `jj` for status, diffs, commits, history, and remote interop; do not use Git write commands in this repo.
- Always commit after each validated state. Do not leave finished slices only in the working-copy commit `@` unless the user explicitly asked to keep changes uncommitted.
- Work in verified slices. After a slice is implemented and checked, commit that slice before starting the next one. Do not wait for the user to ask for a commit when slice work is complete.
- For larger work, make one commit per logical change instead of waiting for one large end-of-task commit.
- Keep commits scoped. Do not include unrelated working-copy changes in a slice commit.
- Write PR-quality commit messages: imperative summary, clear scope, and enough context for review.

## Shared forms

- Before adding or changing an editable form, read the canonical form contract at `packages/forms/FORMS.md` (origin: `~/code/cv/spec/src/30-domain-contracts/forms-and-shared-ui.md`).
- Treat that contract as the implementation standard for this repository. If this repository needs a new form pattern, extend `@beancount-js/forms` first; do not create a Fava-local row, section-header, disclosure, or separator layout.
- Use the shared form primitives for editable fields and sections. Forms use one `max-content minmax(0, 1fr)` label/value grid per scope, visible single separators, title-only collapsible section headers, and a left-rail disclosure control. Content inside a collapsible section is indented; the header itself is not.
- Do not add explanatory text to form section headers. Keep labels and values on the same row at desktop widths. Use existing shadcn-Svelte `Switch` controls for boolean configuration and YAML mode.
- A form toolbar owns collapse/expand-all. Verify title-click collapse, collapsible content indentation, nested collapse state where applicable, no duplicate borders, and no initial desktop horizontal overflow in browser coverage.

## Searchable pickers

- Default to `FilterCommandPicker` from `@beancount-js/forms` for any searchable select (accounts, queries, facets, env var names, enum-like choices). Use `fullWidth` in forms and sidebars.
- For values the user may type that are not in the option list (e.g. Environment credential names from project `.env`), set `allowCustom={true}` on `FilterCommandPicker`. Do not use `SearchableChoicePicker` for new work — it is the legacy picker.
- Multi-select: `multiple` + `values` + `onValuesChange`. Single-select: `value` + `onChange`.
