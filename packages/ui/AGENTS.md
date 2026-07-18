# Storybook MCP

When working on UI components, use the `storybook-mcp-server` MCP tools to consult the live Storybook catalog and validate the change.

## Live reload

- Start the catalog from this package with `pnpm storybook`; do not invoke `storybook dev` directly. The package script enables polling so changes in both `packages/ui` and `packages/forms` are detected reliably.
- Component, style, and existing-story edits should update the preview through HMR. Newly added, renamed, or deleted `.stories.*` files must appear in (or leave) the Storybook index without a restart.
- Restart only after changing Storybook startup configuration, such as `.storybook/main.ts`, addons, or the Vite configuration. Do not treat a stale story index as a reason to restart; verify the file is saved and let the polling watcher update it.

- Before creating or changing a story, a UI component, UI styles, theme tokens, or accessibility behavior, call `get-storybook-story-instructions`.
- After a UI change, call `get-changed-stories`; use `get-stories-by-component` when a changed file is not returned or is shared infrastructure.
- Use `preview-stories` with the returned story IDs to inspect the affected UI. Include the returned preview links in the handoff.
- Run `run-story-tests` for the affected stories while iterating and for the complete catalog before handing off a broad UI change. Resolve failures; do not substitute package scripts for this check.
- The Storybook MCP documentation tools are not available for this Svelte catalog. Do not invent component props: verify them from the component source, TypeScript types, and existing stories.
- If the agent has not loaded `storybook-mcp-server` yet, restart the agent session before beginning UI work.
