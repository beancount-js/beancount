# Fava application-adapter inventory

The design-system catalog is now owned by `@beancount-js/ui`. This historical
Stage 3 inventory records the boundary left in Fava while its production imports
remain unchanged. It supersedes the earlier in-place Fava catalog approach.

## Catalog ownership

`packages/ui/.storybook/main.ts` discovers UI-package sources only. The
canonical visual implementation, Docs page, interaction story, accessibility
coverage, shared theme, and shadcn configuration live in `packages/ui`.

Existing Fava `*.stories.svelte` files are retained as local fixture or
regression material where useful. They are not discovered by the UI catalog and
must not become the source of truth for a reusable component.

| Surface                                                         | Canonical location                  | Fava boundary during the copy stage                                                                                        |
| --------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Shared forms, editors, and form-domain controls                 | `packages/ui/src/components/forms`  | `@beancount-js/forms` remains a compatibility package for existing imports.                                                |
| shadcn-svelte component families                                | `packages/ui/src/components/shadcn` | The editable Fava-local source remains only until consumer migration.                                                      |
| App shell, navigation, tables, charts, dashboards, and feedback | `packages/ui/src/components`        | Fava maps route, ledger, formatter, server, and persisted state into the UI component's display-ready props and callbacks. |

## Retained application adapters

Fava continues to own SvelteKit routes, workspace and project selection,
ledger parsing and formatting, Beancount Query execution, server actions,
file persistence, editor-document positions, and feature workflows. Keep these
responsibilities in Fava when a UI copy is consumed; do not move them into the
design system.

The authoritative visual-surface classification is
`packages/ui/STAGE4_RENDERER_AUDIT.md`. It records the prop-driven UI copy and
the retained Fava responsibility for every production Svelte surface.

## Consumer-migration gate

Do not change a Fava production import merely because a UI copy exists. First
manually inspect that UI component's Storybook Docs and meaningful states in
both themes. Then migrate one bounded consumer slice:

1. Replace only the selected primitive or visual with its UI-package export.
2. Keep the Fava adapter responsible for display-model mapping, routes, stores,
   server calls, and persistence.
3. Preserve the existing Fava source until the migrated adapter is verified; do
   not combine a consumer migration with an unrelated workflow rewrite.
4. Run `pnpm --filter @beancount-js/fava checks` and the relevant tests. If the
   UI component or its story changes, also run
   `pnpm --filter @beancount-js/ui checks`.

The shared app shell is already consumed from `@beancount-js/ui/app-shell`.
All other migrations follow this gate after manual catalog approval.
