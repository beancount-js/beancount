# Active Design Core application UI

This package is the active application and Storybook baseline. Follow
[`spec/src/app-baseline.md`](../../spec/src/app-baseline.md) and keep
[`docs/APP_STATUS.md`](../../docs/APP_STATUS.md) accurate for meaningful changes.

- Consume published Design Core shell, forms and primitives through public
  exports. Keep application actions/controller ownership and injected host
  capabilities explicit. `src/domain` contains the application bridges.
- `catalog/` and `.storybook/` are the sole active Storybook. Fixtures are
  disposable and controller-scoped. Preserve existing story IDs and public
  component/controller contracts unless the requested work requires a change.
- Do not import SvelteKit aliases or private Design Core paths.
- Keep mounted CodeMirror widgets on the owning editor's context. Reuse shared
  account appearance/avatar behavior and preserve replacement/undo semantics.
- Keep application stories bounded to the viewport and standalone stories in
  catalog layout. Test table geometry and internal scrolling, pointer/keyboard
  use, mobile, themes, controller isolation and accessibility when affected.
- Keep `CATALOG_INVENTORY.json` aligned with active routes, navigation states,
  table families and public Design Core imports.
- Run this package's complete `pnpm checks` for every UI slice and verify
  `pnpm exec node scripts/check-catalog.mjs --built`. Commit each verified slice
  with Jujutsu. Record failures and manual-review limits honestly; passing
  browser geometry checks is not screenshot approval.
