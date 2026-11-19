# Beancount language

Studio implements a Beancount-compatible language at the upstream baseline
recorded in `packages/beancount/src/parity/upstream.ts`. This chapter explicitly
separates upstream behavior from Studio additions.

## BC-LANG-001 — Preserve the pinned upstream language baseline

**Requirement.** The parser and accounting loader MUST preserve the supported
behavior of upstream Beancount commit `a3cb3fd9f946d6213dd350fb87709a8ef198301d`,
including query directives, arithmetic number expressions, slash dates,
comma-grouped numbers, and HIFO booking.

### Acceptance details

- The pinned commit and parity manifest identify the imported behavior.
- Focused parser, booking, and oracle tests cover the named syntax and semantics.
- Deliberate local differences are documented in the following requirements.

## BC-LANG-002 — Accept editor-friendly scalar syntax

**Requirement.** Studio MUST accept lowercase Boolean input and unquoted
booking methods while serializing them to canonical uppercase Booleans and
quoted booking-method values.

### Acceptance details

- Parsing accepts the conveniences anywhere the corresponding scalar is valid.
- Formatting produces stable canonical Beancount text.
- Round trips do not change the represented Boolean or booking behavior.

## BC-LANG-003 — Support fenced query and plugin bodies

**Requirement.** Studio MUST accept matching fenced code blocks of three or
more backticks, with an optional language identifier, as query and plugin body
strings while retaining non-directive document markup as editable, non-executed
source.

### Acceptance details

- Opening and closing fences must use the same or a longer valid fence shape.
- Query and plugin bodies expose the fenced content to their owning runtime.
- Non-directive document markup does not create accounting entries.

## BC-LANG-004 — Interpret Studio option directives

**Requirement.** Studio MUST retain `custom "fava-option"` compatibility and
support `custom "ledger-option"` values for `dashboard_collapsed`, `incognito`,
and `plugins`.

### Acceptance details

- Supported options are projected into Studio configuration deterministically.
- Unknown custom directives remain valid Beancount entries.
- Option parsing does not silently enable host capabilities.

## BC-LANG-005 — Resolve plugin configuration predictably

**Requirement.** Inline plugin configuration MUST override global
`ledger-option` defaults; defaults MUST configure only an explicitly declared
plugin and MUST NOT enable a plugin by themselves.

### Acceptance details

- Forecast configuration accepts YAML `now` and `end` fields.
- Credit-card configuration accepts YAML `{ tag: value }` and its legacy plain tag string.
- Configuration-free plugins reject supplied configuration with a loader error.
