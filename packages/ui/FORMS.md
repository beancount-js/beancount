# Forms And Shared UI

UI Forms is the canonical implementation surface for the active contract in
`packages/forms/FORMS.md`.

- Implement reusable form behavior in `packages/ui/src/components/forms`.
- Preserve deliberate `@lapis/ui/forms` and component-subpath exports.
- Keep `packages/forms` implementation-free; it exists only to forward legacy
  imports while the frozen Fava reference remains runnable.
- Follow the Storybook, visual evidence, and validation rules in
  `packages/ui/AGENTS.md` and `packages/ui/FAVA_MIGRATION.md`.
