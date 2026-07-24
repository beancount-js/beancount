# Historical Fava component ownership audit

This paused-state audit was superseded when UI migration resumed on 2026-07-24.

- This `packages/fava` tree remains unchanged as the comparison application.
- Protected captures use the full repository pinned at `191dae81` through the
  `fava-reference` Jujutsu workspace, preventing active UI changes from
  contaminating reference output.
- New integration work belongs in `packages/fava-beta`; reusable presentation
  and Forms implementations belong in `packages/ui`.
- Current status is tracked in `packages/ui/FAVA_MIGRATION.md`.
