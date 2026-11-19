# Application baseline

The Design Core application in `packages/ui`, hosted by `packages/app`, is the
active product baseline on the `beancount-studio` development line. The
pre-Design-Core state remains recoverable at
`archive/pre-design-core-baseline-2026-10-28`; it is history, not an active
implementation queue.

## BC-ARCH-001 — Separate presentation, host, and domain ownership

**Requirement.** `packages/ui` MUST own controllers and presentation,
`packages/app` MUST own executable host and capability wiring, repository
domain packages MUST own parsing/accounting/query/ingestion behavior, and
published Design Core MUST supply shared shell, form, and primitive UI.

### Acceptance details

- Presentation imports only public Design Core and repository package exports.
- Catalog manager dependencies are declared by the UI package.
- Host adapters implement `BeancountDataSource`; they do not own application UI.
- Ownership checks and repository guidance reject retired paths and private coupling.

## BC-ARCH-002 — Isolate mutable runtime state

**Requirement.** Each application controller MUST own its project and ledger
selection, route and query history, sidebar state, requests, caches, services,
and cancellation independently.

### Acceptance details

- Data sources and clocks are injected for each controller.
- Project-scoped errors, results, and cache values stay within their controller.
- Host capability lifetimes remain explicit and disposable.

## BC-ARCH-003 — Keep retired and dormant capabilities inactive

**Requirement.** The active product MUST NOT restore `packages/fava`,
`packages/fava-beta`, `packages/ui-legacy`, or `packages/forms`, and MUST NOT ship
no AI component, provider route, MCP process, ingestion enrichment action, or
AI rule executor.

### Acceptance details

- Historical source remains available through Jujutsu and recorded provenance.
- Older persisted AI flags and provider-backed rules cannot reactivate dormant behavior.
- A future integration MUST use an explicit host-owned extension boundary.
