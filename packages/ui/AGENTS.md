# Active Design Core application UI

This package is the active application and Storybook baseline. Follow
[`spec/src/app-baseline.md`](../../spec/src/app-baseline.md) and keep
[`docs/APP_STATUS.md`](../../docs/APP_STATUS.md) accurate for meaningful changes.

- Consume published Design Core shell, forms and primitives through public
  exports. Keep application actions/controller ownership and injected host
  capabilities explicit. `src/domain` contains the adapted application bridges;
  do not restart the superseded component-extraction/native-CSS campaign.
- `catalog/` and `.storybook/` are the sole active Storybook. Fixtures are
  disposable and controller-scoped. Preserve existing story IDs and public
  component/controller contracts unless the requested work requires a change.
- Do not import retired `@lapis/ui` / `@beancount-js/forms` packages, historical
  Fava source, SvelteKit aliases or private Design Core paths. No compatibility
  package exists in the current checkout.
- Keep mounted CodeMirror widgets on the owning editor's context. Reuse shared
  account appearance/avatar behavior and preserve replacement/undo semantics.
- Keep application stories bounded to the viewport and standalone stories in
  catalog layout. Test table geometry and internal scrolling, pointer/keyboard
  use, mobile, themes, controller isolation and accessibility when affected.
- Validate copied-source provenance at `UI_PROVENANCE.json.sourceCommit` and
  reference fixtures at `CATALOG_INVENTORY.json.referenceCommit`. Do not mutate
  a live reference ledger or recapture/replace frozen evidence casually.
- Run this package's complete `pnpm checks` for every UI slice and verify
  `pnpm exec node scripts/check-catalog.mjs --built`. Commit each verified slice
  with Jujutsu. Record failures and manual-review limits honestly; passing
  browser geometry checks is not screenshot approval.
