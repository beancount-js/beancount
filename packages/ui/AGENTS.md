# Storybook catalog and Fava migration

The UI migration is active. `packages/ui/FAVA_MIGRATION.md` is the source of
truth for phase status, component order, evidence, and the model handoff.

- Keep reusable components prop-driven and application-independent. Fava
  routing, stores, APIs, persistence, ledger derivation, and CodeMirror document
  integration stay in the application adapter.
- Every migrated component needs a deliberate public export, colocated
  Storybook documentation/stories, interaction and accessibility assertions,
  and a protected original-Fava visual reference where it is visually
  comparable.
- Protected Fava images come only from the clean pinned `fava-reference`
  Jujutsu workspace. Ordinary visual-update commands must never overwrite them.
- Automated parity at or below 0.1% advances component work without a
  per-component manual pause. Mark a passing component `visual-ready`; reserve
  `visual-approved` for explicit human acceptance. The only manual validation
  gates are after the Storybook/reference harness, the Forms merge, and the
  final parity audit; their evidence packet and acceptance status belong in
  `FAVA_MIGRATION.md`.
- Update the migration ledger and commit every verified component slice before
  starting another.
- Run `pnpm checks` from this package after each UI-scope change.
