# Fava Beta integration application

`@beancount-js/fava-beta` is the mutable application used to integrate
normalized components from `@lapis/ui`. It begins as a source-equivalent
copy of the frozen `@beancount-js/fava` reference application so full-route
behaviour remains comparable while individual components move.

## Boundaries

- Do not edit `packages/fava`; it remains the visual and behavioural reference.
- Reusable presentation belongs in `@lapis/ui`. Fava Beta owns routes,
  stores, persistence, APIs, ledger derivation, and application adapters.
- Keep every component migration independently reviewable: replace one Beta
  surface with a UI component, remove the obsolete Beta presentation, and run
  the protected visual comparison before recording it as complete.
- Use the fixed Fava reference captures and manifest maintained by
  `packages/ui`. The first component migration defines its matching Beta route
  capture and visual-delta sidecar.

## Working commands

Run the Beta work-in-progress gates directly rather than through the root
aggregate:

```sh
pnpm checks:beta
pnpm test:beta
pnpm test:e2e:beta
pnpm dev:beta
```

Beta's default Playwright server runs on port 5176, leaving Fava's reference
server on port 5174 available for comparison.
