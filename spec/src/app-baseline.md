# Application baseline

The Design Core application in `packages/ui`, hosted by `packages/app`, is the
active product baseline on the `beancount-studio` development line.

## BC-ARCH-001 — Separate presentation, host, and domain ownership

**Requirement.** `packages/ui` MUST own controllers and presentation,
`packages/app` MUST own executable host and capability wiring, repository
domain packages MUST own parsing/accounting/query/ingestion behavior, and
published Design Core MUST supply shared shell, form, and primitive UI.

### Acceptance details

- Presentation imports only public Design Core and repository package exports.
- Catalog manager dependencies are declared by the UI package.
- Host adapters implement `BeancountDataSource`; they do not own application UI.
- Ownership checks validate the current package graph and public boundaries.

## BC-ARCH-002 — Isolate mutable runtime state

**Requirement.** Each application controller MUST own its project and ledger
selection, route and query history, sidebar state, requests, caches, services,
and cancellation independently.

### Acceptance details

- Data sources and clocks are injected for each controller.
- Project-scoped errors, results, and cache values stay within their controller.
- Host capability lifetimes remain explicit and disposable.

## BC-ARCH-003 — Keep the delivery surface explicit

**Requirement.** The active product MUST expose one UI and host path and MUST
NOT ship an AI component, provider route, MCP process, ingestion enrichment
action, or AI rule executor.

### Acceptance details

- Package and catalog checks enforce the single supported UI and host path.
- Persisted AI flags and provider-backed rules cannot activate behavior.
- A future integration MUST use an explicit host-owned extension boundary.
