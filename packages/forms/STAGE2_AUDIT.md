# Historical Forms migration status

The paused state recorded on 2026-07-22 was superseded when UI migration
resumed on 2026-07-24.

- Active behavior guidance remains in `packages/forms/FORMS.md`.
- Canonical implementation and Storybook ownership moves to
  `@lapis/ui/forms`.
- This package is now an implementation-free compatibility facade. Its public
  package surface and the two historical Fava test-helper paths forward to UI.
- The completed consolidation and compatibility evidence is tracked in
  `packages/ui/FAVA_MIGRATION.md`.
