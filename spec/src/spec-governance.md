# Specification governance

## BC-GOV-001 — Keep one canonical requirement set

**Requirement.** Product behavior requirements shall live under `spec/src`, use
stable `BC-AREA-NNN` identifiers, and have exactly one verification row with a
status and concrete evidence.

### Acceptance details

- The summary lists every canonical chapter in publication order.
- Other documentation links to requirements instead of redefining them.
- Chapters remain within repository line and byte limits.

## BC-GOV-002 — Make specifications discoverable and publishable

**Requirement.** The repository shall validate and build the specification with
spec-validator and mdBook and shall maintain a QMD collection for local search.

### Acceptance details

- Search has a documented `rg` fallback when QMD is unavailable.
- Generated book and search artifacts are not committed.
- Doctor output reports a healthy repository integration.

## BC-GOV-003 — Require spec-first product changes

**Requirement.** Changes to protected product or governance paths shall update
an owning canonical specification chapter in the same change.

### Acceptance details

- Protected paths map to relevant chapters rather than any arbitrary spec file.
- Tests, fixtures, generated output, dependencies, and MDX mirrors are excluded.
- Agents search requirements before manually scanning implementation files.

## BC-GOV-004 — Run complete local governance checks

**Requirement.** `pnpm spec:check` shall validate and build specifications,
enforce spec-first history, verify baseline ownership, and validate the source
catalog; root `pnpm checks` shall run it before the complete functional checks.

### Acceptance details

- Focused commands remain available for validate, first, build, search, and index.
- Functional checks retain their own explicit root command.
- A failing governance or functional check remains a failing root check.

## BC-GOV-005 — Enforce specifications and application checks in GitHub

**Requirement.** Pull requests and pushes to `beancount-studio` shall run named
`Specification` and `Application` checks, and the development branch shall
require pull requests and both up-to-date checks while allowing solo maintenance.

### Acceptance details

- CI uses full history for spec-first comparison and a frozen dependency install.
- Branch protection requires zero human approvals and blocks force-push/deletion.
- The application job runs the functional checks and root tests with Chromium.
