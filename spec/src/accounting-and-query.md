# Accounting and query

## BC-CORE-001 — Load complete ledger projects

**Requirement.** The accounting runtime MUST load entry files and includes,
return typed directives and options, and report parse or transformation errors
without discarding successfully loaded entries.

### Acceptance details

- Include resolution is delegated to the owning workspace or host.
- Loading supports raw and transformed modes.
- Diagnostics identify their source and remain available to the application.

## BC-CORE-002 — Apply accounting transformations deterministically

**Requirement.** The runtime MUST perform booking, interpolation, balance and
pad processing, realization, prices, and inventory transformations with stable
decimal semantics.

### Acceptance details

- Transformation order is explicit and repeatable.
- Booking methods and account-specific overrides are honored.
- Errors are returned as domain diagnostics rather than hidden exceptions.

## BC-CORE-003 — Execute declared plugins safely

**Requirement.** The loader MUST execute supported declared plugins according
to plugin mode and configuration, preserving entry ordering and returning
plugin failures as diagnostics.

### Acceptance details

- Raw mode limits execution to the declared plugin stage.
- Default mode applies the supported post-processing pipeline.
- Unsupported plugins and invalid configurations produce actionable errors.

## BC-CORE-004 — Provide filters, BQL, and reports

**Requirement.** Studio MUST provide filter expressions, Bean Query Language
execution, and the report projections required by the active application.

### Acceptance details

- Parsers produce typed syntax and useful diagnostics.
- Queries operate against loaded Beancount entries and exposed sources.
- Reports preserve account, transaction, lot, price, and date semantics.
