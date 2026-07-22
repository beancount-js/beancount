# UI renderer audit status

The design-system renderer migration is paused.

- No new Fava visual copy should be moved into `packages/ui` while this pause is in effect.
- Keep existing `@beancount-js/ui` renderer sources and discovery settings unchanged.
- Continue using `packages/fava` for application adapters and `packages/forms` for form reuse.
