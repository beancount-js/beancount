# Ingestion and rules

## BC-ING-001 — Connect external transaction sources through host services

**Requirement.** Server mode MUST expose project-scoped connectors for the
supported Monzo, Starling, and Lunch Flow sources without placing credentials
or live bank requests in the presentation package.

### Acceptance details

- Credentials are represented by host-owned secret references.
- Connector discovery and configuration produce actionable diagnostics.
- Fixture and route tests do not claim qualification of external credentials.

## BC-ING-002 — Import and synchronize repeatably

**Requirement.** Import and synchronization jobs MUST normalize connector data,
track progress and events, and avoid duplicating previously accepted source
transactions.

### Acceptance details

- Jobs expose project-scoped running, completed, failed, and cancelled states.
- Import previews remain reviewable before ledger mutation.
- Repeated synchronization uses stable source identities and checkpoints.

## BC-ING-003 — Resolve merchant identity and presentation

**Requirement.** Studio MUST maintain merchant catalogs, profiles, brand
matching, logo caching, and review state as host services consumable by the UI.

### Acceptance details

- Merchant matches retain their source and confidence or review status.
- Cached logos and account identities do not leak across controller projects.
- Users can review and revise proposed merchant presentation.

## BC-ING-004 — Apply deterministic rules

**Requirement.** Rule evaluation MUST be ordered, deterministic, reviewable,
and limited to the active non-AI rule actions before it mutates ledger data.

### Acceptance details

- Preview and apply use the same rule semantics.
- Provider-backed or AI rule executors remain excluded from the active host.
- Invalid actions produce diagnostics and do not partially apply silently.

## BC-ING-005 — Reconcile imports with revision safety

**Requirement.** Reconciliation MUST compare imported candidates with ledger
entries, preserve review decisions, and apply accepted changes only against the
expected project revision.

### Acceptance details

- Candidate, matched, ignored, and applied states are distinguishable.
- Revision conflicts require refresh or explicit user resolution.
- Applying reconciliation produces valid editable Beancount source.
