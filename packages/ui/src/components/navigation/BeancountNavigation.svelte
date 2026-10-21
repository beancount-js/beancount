<script lang="ts">
  import {
    FolderOpen,
    LayoutPanelLeft,
    SearchIcon,
    Plus,
  } from "@lucide/svelte";
  import type { BeancountController, SidebarMode } from "../../controller";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { FormField } from "../forms";
  import BeancountLedgerNavigation from "./BeancountLedgerNavigation.svelte";
  import Search from "../../domain/components/Search.svelte";
  let {
    controller,
    onNavigate,
  }: { controller: BeancountController; onNavigate: () => void } = $props();
  const sidebar = $derived(controller.state.sidebar);
  const actions = $derived(controller.actions.sidebar);
  const modes = [
    { id: "projects", label: "Projects", icon: FolderOpen },
    { id: "workspace", label: "Workspace", icon: LayoutPanelLeft },
    { id: "search", label: "Search", icon: SearchIcon },
  ] as const;
</script>

<div class="beancount-navigation flex h-full min-h-0 flex-1 flex-col gap-3 p-2">
  {#if !sidebar.settings}
    <ToggleGroup.Root
      type="single"
      value={sidebar.mode}
      onValueChange={(value) => {
        if (value) actions.setMode(value as SidebarMode);
      }}
      spacing={1}
      size="sm"
      class="beancount-sidebar-modes"
      aria-label="Sidebar modes"
    >
      {#each modes as mode}
        <ToggleGroup.Item
          value={mode.id}
          data-sidebar-mode={mode.id}
          aria-label={mode.label}
          title={mode.label}><mode.icon /></ToggleGroup.Item
        >
      {/each}
    </ToggleGroup.Root>
  {/if}
  {#if sidebar.settings || sidebar.mode === "workspace"}
    <BeancountLedgerNavigation {controller} {onNavigate} />
  {:else if sidebar.mode === "search"}
    <Search />
  {:else}
    <section
      class="flex min-h-0 flex-col gap-2 overflow-y-auto"
      aria-label="Projects"
    >
      <h2 class="text-xs font-medium text-muted-foreground">Current project</h2>
      {#each controller.state.projects as project}
        <Button
          variant={project.id === controller.state.snapshot?.project.id
            ? "secondary"
            : "ghost"}
          class="h-auto w-full justify-start py-2"
          data-sidebar-project={project.id}
          aria-current={project.id === controller.state.snapshot?.project.id
            ? "page"
            : undefined}
          onclick={() =>
            controller.actions.selectProject(project.id).catch(() => {})}
        >
          <FolderOpen data-icon="inline-start" /><span class="min-w-0 text-left"
            ><span class="block truncate">{project.name}</span><span
              class="block truncate text-xs text-muted-foreground"
              >{project.entryFile}</span
            ></span
          >
        </Button>
      {/each}
      {#if controller.state.canAddProject}
        {#if sidebar.projectFormOpen}
          <form
            class="flex min-w-0 flex-col gap-2"
            aria-label="Open project"
            onsubmit={(event) => {
              event.preventDefault();
              void controller.actions.addProject(
                sidebar.projectPath.trim() || undefined,
              );
            }}
          >
            <div class="beancount-structured-form">
              <FormField label="Path" align="center"
                ><Input
                  aria-label="Project path"
                  placeholder="Project path"
                  value={sidebar.projectPath}
                  oninput={(event) =>
                    actions.setProjectPath(event.currentTarget.value)}
                  disabled={sidebar.projectOpening}
                /></FormField
              >
            </div>
            {#if sidebar.projectError}<p
                role="alert"
                class="text-xs text-destructive"
                data-project-action-error
              >
                {sidebar.projectError}
              </p>{/if}
            <div class="flex gap-2">
              <Button type="submit" size="sm" disabled={sidebar.projectOpening}
                >{sidebar.projectOpening
                  ? "Opening project…"
                  : "Open project"}</Button
              ><Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={sidebar.projectOpening}
                onclick={actions.cancelProjectOpen}>Cancel</Button
              >
            </div>
          </form>
        {:else}
          <Button variant="outline" size="sm" onclick={actions.beginProjectOpen}
            ><Plus data-icon="inline-start" />Open another project</Button
          >
        {/if}
      {/if}
    </section>
  {/if}
</div>

<style>
  .beancount-navigation :global(.beancount-sidebar-modes) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    gap: 0.25rem;
    padding: 0.25rem;
    border: 1px solid var(--sidebar-border, var(--border));
    border-radius: 0.375rem;
    background: color-mix(
      in srgb,
      var(--sidebar-accent, var(--accent)) 50%,
      transparent
    );
  }
  .beancount-navigation :global([data-sidebar-mode]) {
    width: 100%;
    min-width: 0;
    height: 2rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    color: var(--muted-foreground);
    background: transparent;
  }
  .beancount-navigation :global([data-sidebar-mode][data-state="on"]) {
    border-color: var(--sidebar-border, var(--border));
    background: var(--background);
    color: var(--sidebar-accent-foreground, var(--foreground));
    box-shadow: 0 1px 2px color-mix(in srgb, var(--foreground) 5%, transparent);
  }
  .beancount-navigation :global([data-sidebar-project]) {
    width: 100%;
    min-width: 0;
    height: auto;
    justify-content: flex-start;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .beancount-navigation :global([data-sidebar-project] > span) {
    overflow: hidden;
  }
  .beancount-navigation :global([data-ledger-file-row]) {
    height: 2rem;
    min-height: 0;
    padding-inline: 0.25rem;
    gap: 0.25rem;
    font-size: 0.75rem;
  }

  .beancount-navigation :global([data-ledger-file-panels] button),
  .beancount-navigation :global([data-review-ledger-panels] button),
  .beancount-navigation :global([data-ledger-file-row]),
  .beancount-navigation :global([data-ledger-folder-row]),
  .beancount-navigation :global([data-ledger-tag-row]),
  .beancount-navigation :global([data-ledger-settings-sidebar] button) {
    justify-content: flex-start;
  }
  .beancount-navigation :global(label > input) {
    padding-inline-start: 2rem;
  }

  .beancount-navigation :global([data-ledger-file-toggle]) {
    width: 1.75rem;
    height: 1.75rem;
    min-height: 0;
    padding: 0;
    border-radius: 0.125rem;
  }
  .beancount-navigation :global([data-ledger-file-toggle]),
  .beancount-navigation
    :global([data-ledger-tag-node] > div > button[aria-expanded]) {
    background: transparent;
    box-shadow: none;
    border: 0;
  }
  .beancount-navigation :global([data-ledger-file-toggle]:hover),
  .beancount-navigation
    :global([data-ledger-tag-node] > div > button[aria-expanded]:hover) {
    background: var(--accent);
  }
  .beancount-navigation :global([data-ledger-tag-row]) {
    height: 2rem;
    min-height: 0;
    padding: 0 0.25rem 0 0.75rem;
    gap: 0.5rem;
    font-size: 0.75rem;
  }
  .beancount-navigation
    :global([data-ledger-tag-node] > div > button[aria-expanded]) {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    flex: none;
  }
  .beancount-navigation :global([data-ledger-tag-node] svg),
  .beancount-navigation :global([data-ledger-file-toggle] svg) {
    width: 1rem;
    height: 1rem;
    stroke-width: 2;
  }
</style>
