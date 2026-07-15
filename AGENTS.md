# Beancount JS Studio Agent Guide

## Shared forms

- Before adding or changing an editable form, read the canonical form contract at `packages/forms/FORMS.md` (origin: `~/code/cv/spec/src/30-domain-contracts/forms-and-shared-ui.md`).
- Treat that contract as the implementation standard for this repository. If this repository needs a new form pattern, extend `@beancount-js/forms` first; do not create a Fava-local row, section-header, disclosure, or separator layout.
- Use the shared form primitives for editable fields and sections. Forms use one `max-content minmax(0, 1fr)` label/value grid per scope, visible single separators, title-only collapsible section headers, and a left-rail disclosure control. Content inside a collapsible section is indented; the header itself is not.
- Do not add explanatory text to form section headers. Keep labels and values on the same row at desktop widths. Use existing shadcn-Svelte `Switch` controls for boolean configuration and YAML mode.
- A form toolbar owns collapse/expand-all. Verify title-click collapse, collapsible content indentation, nested collapse state where applicable, no duplicate borders, and no initial desktop horizontal overflow in browser coverage.
