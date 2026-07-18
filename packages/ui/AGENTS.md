# Storybook catalog

When working on UI components, use the `storybook-mcp-server` MCP tools to consult the live Storybook catalog and validate the change.

## Component documentation

- `@storybook/addon-docs` is enabled and the shared preview applies the `autodocs` tag. Stories are therefore the living documentation: each component automatically receives a Docs page from its metadata, props, args, and examples. `UI Forms/Guidance` is the catalog's high-level form decision guide; retain generated Docs pages and link every reusable form primitive back to it.
- Add or update a colocated `ComponentName.stories.svelte` in the same change as every component. Point `defineMeta` at the actual component, give the story group a clear catalog title, and give each story a human-readable scenario name.
- Type every public prop and add short JSDoc to non-obvious props, events, and state. Use a Docs description when that source-level information and the story names would not explain the component's intent or constraints.
- Update the Form guidance page whenever form composition, control choice, disclosure, repeated-item, or verification rules change. The guide owns high-level rules; component Docs descriptions state the component-specific constraints and link to the guide.
- `Shadcn/` is the Fava-local component catalog. Its stories live beside the source in `packages/fava/src/lib/components/ui` and render the current Fava implementations using the shared catalog theme. Do not copy those components into `@beancount-js/ui` merely to document them; new reusable cross-app primitives still belong in `@beancount-js/ui`.
- Document the meaningful behaviour, not only the default: collectively cover distinct variants, validation/error and empty/loading states, permissions or feature states, themes, and responsive layouts when they alter behaviour. Do not duplicate equivalent visuals.
- Interactive examples must be genuinely interactive. Their play functions must exercise the real control flow and assert a visible or accessible result as well as any callback; a callback assertion alone is insufficient.

## Live reload

- Start the catalog from this package with `pnpm storybook`; do not invoke `storybook dev` directly. The package script enables polling so changes in both `packages/ui` and `packages/forms` are detected reliably.
- Component, style, and existing-story edits should update the preview through HMR. Newly added, renamed, or deleted `.stories.*` files must appear in (or leave) the Storybook index without a restart.
- Restart only after changing Storybook startup configuration, such as `.storybook/main.ts`, addons, or the Vite configuration. Do not treat a stale story index as a reason to restart; verify the file is saved and let the polling watcher update it.

- Before creating or changing a story, a UI component, UI styles, theme tokens, or accessibility behavior, call `get-storybook-story-instructions`.
- After a UI change, call `get-changed-stories`; use `get-stories-by-component` when a changed file is not returned or is shared infrastructure.
- Use `preview-stories` with the returned story IDs to inspect the affected UI. Include the returned preview links in the handoff.
- Run `run-story-tests` for the affected stories while iterating and for the complete catalog before handing off a broad UI change. A focused run that executes no stories or reports only skipped stories is not proof of success; use the full catalog run to verify it.
- Run `pnpm checks` in this package before committing UI work as well. It verifies formatting, `svelte-check` (including warnings), Storybook Vitest tests, and the static Storybook build; it complements rather than replaces `run-story-tests`.
- The Storybook MCP documentation tools are not available for this Svelte catalog. Do not invent component props: verify them from the component source, TypeScript types, and existing stories.
- If the agent has not loaded `storybook-mcp-server` yet, restart the agent session before beginning UI work.

## Accessibility and theme

- Accessibility tests inherit `a11y.test: "error"`; resolve real violations and warnings in the component or story rather than weakening the global rules. Keep the test canvas scoped to the component under test.
- `.cm-gutters` is the sole scoped exclusion: CodeMirror's non-focusable, `aria-hidden` line numbers and fold glyphs are decorative one-character annotations that axe cannot assess for contrast. Do not extend that exclusion or use it to hide editable editor content or controls.
- Storybook deliberately disables the backgrounds addon. Select the catalog's `theme` global instead; the decorator applies the same `.dark` class and shared UI token styles used by Fava. Do not add competing background globals or import Fava-only styles into stories.
- CodeMirror syntax colours are shared theme variables. When changing editor styling, update the shared palette and verify both themes and both consumers instead of adding a Storybook-only override.
