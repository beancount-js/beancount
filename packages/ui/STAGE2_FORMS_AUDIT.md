# UI Forms audit status

The UI migration is paused.

- Do not add new form exports, stories, or compatibility changes in `packages/ui`.
- Existing `@beancount-js/ui/forms` imports and source are preserved.
- New reusable form work should use `@beancount-js/forms` and `packages/fava` local feature ownership.
