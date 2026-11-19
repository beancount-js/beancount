# Application UI

## BC-APP-001 — Compose one navigable application shell

**Requirement.** The active UI shall compose the Design Core shell with project,
ledger, route, query-history, sidebar, and navigation state owned by each
controller instance.

### Acceptance details

- Navigation covers the active dashboard, editor, reports, journal, query,
  account, ingestion, and settings surfaces.
- Keyboard, pointer, and mobile navigation remain usable.
- Multiple controller instances do not share mutable project state.

## BC-APP-002 — Edit ledger source without losing document context

**Requirement.** The editor shall provide Beancount syntax, diagnostics,
completion, search, and revision-aware save behavior while preserving undo,
selection, and non-directive document markup.

### Acceptance details

- Conflicting revisions are surfaced rather than overwritten silently.
- Embedded editor controls retain native keyboard and pointer behavior.
- Save and reload preserve canonical source semantics.

## BC-APP-003 — Present accounting tables and reports accessibly

**Requirement.** Journal, account, query, transaction, and report views shall
render their accounting data with usable sorting, filtering, pagination,
selection, and responsive containment.

### Acceptance details

- Tables expose meaningful names and keyboard-operable actions.
- Empty, loading, and error states remain distinguishable.
- Geometry checks prevent clipped controls and unintended page overflow.

## BC-APP-004 — Use consistent forms and account identity

**Requirement.** Structured forms shall use public Design Core forms and shared
Studio controls, with one aligned label/value grid per scope and portable
account identity rendered consistently across forms, tables, and editors.

### Acceptance details

- `FormField as="div" align="center"` wraps pill, date, and searchable controls.
- `FilterCommandPicker` is the searchable picker; `fullWidth` and `allowCustom`
  are used when the context requires them.
- Form toolbars own collapse-all behavior, including nested and newly loaded
  disclosures, and layouts avoid duplicate separators and horizontal overflow.

## BC-APP-005 — Preserve responsive and recoverable states

**Requirement.** Application surfaces shall remain usable across supported
desktop and mobile widths and shall expose loading, cancellation, empty, and
recoverable error states without leaking state between projects.

### Acceptance details

- Long-running requests can be cancelled or superseded safely.
- Theme, modal, popover, and focus behavior remain isolated per active surface.
- Automated browser checks qualify function and accessibility, not human visual
  approval or production backend readiness.
