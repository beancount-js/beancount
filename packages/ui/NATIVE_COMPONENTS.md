# Native component architecture

This document defines the target architecture for locally owned
`@beancount-js/ui` primitives and composed presentation.

`packages/ui/FAVA_MIGRATION.md` remains the progress and validation ledger.
This file is the stable implementation contract.

## Objective

- Own primitive Svelte source and styling in `@beancount-js/ui`.
- Keep shadcn as source provenance and compatibility naming, not as a runtime
  or build dependency.
- Use native CSS, semantic theme tokens, and component-scoped `--ui-*` tokens.
- Reject new Tailwind utilities in UI and Fava Beta production source.
- Remove Fava Beta's duplicate primitive implementation.
- Keep routes, stores, persistence, APIs, ledger derivation, and CodeMirror
  document integration in Fava Beta adapters.

## Package boundary

Primitive families remain under:

```text
src/components/shadcn/<family>/
  index.ts
  *.svelte
  <family>.tokens.css
  <family>.tokens.ts
  <family>.provenance.json
  *.stories.svelte
```

The `./shadcn/*` public export remains during this migration. The name records
the component API's provenance and avoids an unrelated package-wide rename.
Implementation and styling are owned by `@beancount-js/ui`.

The package must not import:

- `shadcn-svelte`
- `tailwindcss`, `tailwind-merge`, or `tailwind-variants`
- application `$lib` aliases
- `@beancount-js/forms`
- Fava or Fava Beta source

Behaviour-focused libraries such as `bits-ui` may remain where they provide
accessible focus, keyboard, selection, or overlay semantics.

## Styling contract

### Foundation tokens

`foundation.tokens.css` owns framework-independent values for:

- spacing
- typography
- radii
- shadows
- motion
- focus rings
- overlay layers

`theme.css` owns semantic colour roles. Component token files map stable
`--ui-<family>-*` names onto foundation and theme values.

Component CSS must not depend on Tailwind-generated variables such as
`--spacing`, `--text-sm`, or `--tw-*`.

### Component identity

Primitive hosts use:

- `data-ui-component`
- `data-ui-part`
- `data-variant`
- `data-size`

Variants and sizes are typed props rendered as data attributes. Components do
not generate variant class strings.

Composed components use scoped semantic classes prefixed with `cn-`. Consumer
customisation uses props, snippets, callbacks, and documented component tokens.

### Tailwind boundary

Production `.svelte` and relevant `.ts` source is guarded by the repository
Tailwind ratchet. Existing findings are recorded per file and token. A change
may remove findings but may not add them.

As files are converted, their baseline entries are removed. Completion requires
an empty baseline for:

- `packages/ui/src/components`
- `packages/fava-beta/src`

Storybook's existing demo-only utility layout is frozen into static catalog CSS.
The package does not compile Tailwind, and production component styling remains
native and token-based.

## API compatibility

- Preserve existing barrels, named exports, root aliases, props, and events
  unless a behaviour defect requires a deliberate change.
- Replace `buttonVariants()` and similar class generators at their call sites
  before removing them.
- Keep dialog, sheet, drawer, and popover titles and focus behaviour accessible.
- Keep select, command, dropdown, and tabs children inside their required
  primitive groups.
- Keep app-owned CodeMirror widgets as adapters around shared controls.

## Migration order

1. Leaf controls: button, input, textarea, badge, label, separator, skeleton,
   spinner, and progress.
2. Stateful controls: checkbox, switch, toggle, toggle-group, tabs, accordion,
   and collapsible.
3. Overlays: tooltip, popover, dialog, sheet, select, dropdown-menu, command,
   and alert-dialog.
4. Structural primitives: table, data-table, pagination, scroll-area, sidebar,
   calendar, and menubar.
5. Shared compositions: layout/navigation, forms, tables/feedback, then
   pages/charts/dashboard.
6. Fava Beta consumers and app-owned adapters.

Unused Beta-only primitives are removed rather than migrated.

## Slice validation

Each verified slice runs:

- the Tailwind policy unit tests
- the affected package Tailwind ratchet
- focused primitive or composed-component tests
- Storybook interaction and accessibility coverage
- `pnpm checks:ui`
- `pnpm checks:beta` when a shared public API or Beta consumer changes
- affected Fava Beta unit, build, and browser tests

Protected Fava reference captures remain immutable. C006 and the final G03
manual review run after the native component alignment is complete.
