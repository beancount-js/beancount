# Frozen Fava compatibility UI

This private package retains the `@lapis/ui` public imports used by the existing
Fava and Fava Beta hosts and the `@beancount-js/forms` forwarding facade.
It has no Storybook, visual baselines, Visual Delta configuration or extraction
workflow. Its production source is preserved from
`archive/pre-design-core-baseline-2026-10-28`.

New application work belongs in `packages/ui` (`@beancount-js/ui`) and uses the
published `@lapismd/design-core` shell, forms and primitives. Do not add features
or a second catalog here. Remove this package only after all retained consumers
have moved to the new application/controller contracts.

Run `pnpm --filter @lapis/ui test:run` to check the retained runtime helpers.
