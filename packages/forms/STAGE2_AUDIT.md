# Forms migration status

The UI-package migration is paused as of 2026-07-22.

Current active form guidance lives in `packages/forms/FORMS.md`.

- Keep existing `@beancount-js/ui/forms` components in place.
- Do not add reusable form work to `packages/ui` or add new UI-package imports for forms.
- Add new reusable form work to `@beancount-js/forms` and reuse existing Fava-local work for product-specific UI patterns.
- Resume only when explicit project authorization explicitly reopens the UI migration.
