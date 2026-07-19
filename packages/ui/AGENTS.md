# Storybook catalog

When working on UI components, use the local Storybook catalog and its browser tests to validate the change.

## Component documentation

- `@storybook/addon-docs` is enabled and the shared preview applies the `autodocs` tag. Stories are therefore the living documentation: each component automatically receives a Docs page from its metadata, props, args, and examples. `UI Forms/Guidance` is the catalog's high-level form decision guide; retain generated Docs pages and link every reusable form primitive back to it.
- Add or update a colocated `ComponentName.stories.svelte` in the same change as every component. Point `defineMeta` at the actual component, give the story group a clear catalog title, and give each story a human-readable scenario name.
- Type every public prop and add short JSDoc to non-obvious props, events, and state. Use a Docs description when that source-level information and the story names would not explain the component's intent or constraints.
- Update the Form guidance page whenever form composition, control choice, disclosure, repeated-item, or verification rules change. The guide owns high-level rules; component Docs descriptions state the component-specific constraints and link to the guide.
- Before adding a visual form export, classify it in `packages/ui/STAGE2_FORMS_AUDIT.md` as a shared primitive, retained domain component, or deprecated compatibility. Keep its implementation, styles, stories, and supporting APIs in this package; helper-only exports do not need standalone visual stories.
- For date configuration, use the shared `DatePicker`; applications retain source parsing, persistence, and CodeMirror extension placement. For compact, read-only source output, use `CodeHighlighter` with an application-supplied Lezer parser. It uses the shared syntax palette; language setup and editable CodeMirror extensions remain application-owned. Use `ReviewDiff` for source-agnostic before/after review; workflows still own approval and persistence.
- `Shadcn/` is the UI-owned shadcn-svelte catalog. Its source and stories live together in `packages/ui/src/components/shadcn`; import a family from `@beancount-js/ui/shadcn/<family>`. Fava's original local source remains unchanged only until its later application migration.
- During the design-system copy, generic layout and navigation source belongs in `src/components/layout` and `src/components/navigation`, with colocated stories. Preserve Fava originals until the separate application migration; UI copies must receive explicit props and callbacks rather than importing the Fava router or workspace context.
- The UI package must be self-contained: do not resolve Fava source, Fava dependencies, `$lib`, or SvelteKit application aliases from UI source or package configuration. `pnpm check-boundaries` enforces this before every full UI gate.
- `Layout/Guidance` is the catalog's high-level layout and navigation guide. Update it when frame, scrolling, sidebar navigation, cycling-control, or pagination rules change.
- Put prop-driven table, chart, and feedback copies in `src/components/tables`, `src/components/charts`, and `src/components/feedback`. They must not import Fava context, routes, stores, or server APIs; preserve the Fava source until its explicit application migration.
- Use the renderer audit in `STAGE4_RENDERER_AUDIT.md` to classify every Fava visual surface. Table and feedback models receive display-ready values and callbacks; Fava retains parsing, formatting, ledger-derived state, routes, and persistence until the separate consumer migration.
- Once an independent UI copy has passing stories, remove its _direct_ Fava story from `.storybook/main.ts` so the UI source is the catalog contract. Keep an application composition story only when it still represents an uncopied application adapter.
- Verify complex grid tracks visually. Prefer a small scoped CSS class for dynamic or multi-track grids instead of relying on a Tailwind arbitrary value embedded in a conditional class string; an omitted/escaped value can silently collapse the layout to one column.
- Document the meaningful behaviour, not only the default: collectively cover distinct variants, validation/error and empty/loading states, permissions or feature states, themes, and responsive layouts when they alter behaviour. Do not duplicate equivalent visuals.
- Interactive examples must be genuinely interactive. Their play functions must exercise the real control flow and assert a visible or accessible result as well as any callback; a callback assertion alone is insufficient.

## Live reload

- Start the catalog from this package with `pnpm storybook`; do not invoke `storybook dev` directly. The package script enables polling so UI-owned source and colocated stories are detected reliably.
- Component, style, and existing-story edits should update the preview through HMR. Newly added, renamed, or deleted `.stories.*` files must appear in (or leave) the Storybook index without a restart.
- Restart only after changing Storybook startup configuration, such as `.storybook/main.ts`, addons, or the Vite configuration. Do not treat a stale story index as a reason to restart; verify the file is saved and let the polling watcher update it.

- Inspect the affected stories in the local catalog when visual review is needed, and run their Storybook Vitest coverage while iterating. A focused run that executes no stories or reports only skipped stories is not proof of success; run the complete catalog before handing off a broad UI change.
- Run `pnpm checks` in this package before committing UI work. It verifies formatting, `svelte-check` (including warnings), Storybook Vitest tests, and the static Storybook build.
- Do not invent component props: verify them from the component source, TypeScript types, and existing stories.

## Accessibility and theme

- Accessibility tests inherit `a11y.test: "error"`; resolve real violations and warnings in the component or story rather than weakening the global rules. Keep the test canvas scoped to the component under test.
- `.cm-gutters` is the sole scoped exclusion: CodeMirror's non-focusable, `aria-hidden` line numbers and fold glyphs are decorative one-character annotations that axe cannot assess for contrast. Do not extend that exclusion or use it to hide editable editor content or controls.
- Storybook deliberately disables the backgrounds addon. Select the catalog's `theme` global instead; the decorator applies the same `.dark` class and shared UI token styles used by Fava. Do not add competing background globals or import Fava-only styles into stories.
- CodeMirror syntax colours are shared theme variables. When changing editor styling, update the shared palette and verify both themes and both consumers instead of adding a Storybook-only override.
