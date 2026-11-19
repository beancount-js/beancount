# Hosts and storage

## BC-HOST-001 — Keep host capabilities behind the data-source boundary

**Requirement.** Presentation code MUST obtain projects, files, resources,
services, clocks, and optional requests through `BeancountDataSource` rather
than importing filesystem, server, or browser persistence implementations.

### Acceptance details

- Data sources are injected per controller instance.
- Cancellation, caching, errors, and lifetimes stay scoped to their owner.
- The generic request method remains provider-neutral.

## BC-HOST-002 — Serve repository workspaces in server mode

**Requirement.** The executable server host MUST expose revision-aware project,
file, resource, ingestion, merchant, rule, and reconciliation capabilities for
the configured repository workspace.

### Acceptance details

- Project root and entry file are explicit host configuration.
- Same-origin routes enforce project and filesystem boundaries.
- The CLI launches the supported server build rather than a retired app.

## BC-HOST-003 — Persist browser workspaces directly

**Requirement.** Static web mode MUST use browser workspace capabilities,
including OPFS or an explicitly selected local directory, without depending on
server-only routes.

### Acceptance details

- Saving and reloading retains ledger content across a full browser reload.
- Capability failures are surfaced as recoverable UI states.
- Server-only ingestion and secrets are not implied by static mode.

## BC-HOST-004 — Deliver executable and catalog builds

**Requirement.** The repository MUST build the server host, static web host,
CLI launcher, and sole Storybook catalog from the active package graph.

### Acceptance details

- Production builds reject retired package dependencies.
- GitHub Pages publishes the same catalog built locally.
- Build success remains distinct from live-bank or human-visual qualification.
