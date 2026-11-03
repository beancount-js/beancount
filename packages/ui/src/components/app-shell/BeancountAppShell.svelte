<script lang="ts">
  import { ChevronLeft, ChevronRight, Settings } from "@lucide/svelte";
  import {
    AppShell,
    type AppShellController,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { tick, type Snippet } from "svelte";
  let {
    controller,
    displayMode = "auto",
    canNavigateBack = false,
    canNavigateForward = false,
    onBack,
    onForward,
    navigation,
    content,
    details,
    title = "Beancount Studio",
    projectName = "Beancount Studio",
    onOpenSettings,
    toolbar,
    toolbarLeading,
  }: {
    controller: AppShellController;
    displayMode?: AppShellDisplayMode;
    canNavigateBack?: boolean;
    canNavigateForward?: boolean;
    onBack?: () => void;
    onForward?: () => void;
    navigation?: Snippet;
    content?: Snippet;
    details?: Snippet;
    title?: string;
    projectName?: string;
    onOpenSettings?: () => void;
    toolbar?: Snippet;
    toolbarLeading?: Snippet;
  } = $props();
</script>

<div
  class="beancount-shell"
  data-mobile={controller.mobile.resolvedMode === "mobile"}
>
  <nav aria-label="Application navigation" class="beancount-shell__header">
    <AppShell.Sidebar.Toggle shellController={controller} side="left" />
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Back"
      disabled={!canNavigateBack}
      onclick={onBack}><ChevronLeft aria-hidden="true" /></Button
    >
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Forward"
      disabled={!canNavigateForward}
      onclick={onForward}><ChevronRight aria-hidden="true" /></Button
    >
    {#if details}<AppShell.Sidebar.Toggle
        shellController={controller}
        side="right"
        label="Toggle AI panel"
        class="beancount-shell__assistant-toggle"
        onclick={async (event) => {
          const opening =
            event.currentTarget.getAttribute("aria-expanded") !== "true";
          // A closed panel's constraints resolve after the shared toggle opens it.
          await tick();
          if (
            opening &&
            controller.mobile.resolvedMode !== "mobile" &&
            controller.isPanelConstrained("right")
          )
            controller.setPanelDesktopPreviewed("right", true);
        }}
      />{/if}
  </nav>
  <div class="beancount-shell__stage">
    <AppShell.Root
      class="beancount-shell__surface"
      {controller}
      {displayMode}
      mobileBreakpoint={1024}
      desktopMinMainWidth={360}
    >
      <AppShell.Sidebar
        side="left"
        label="Ledger navigation"
        resizable
        mobileLabel="Navigation"
        >{#if controller.mobile.resolvedMode !== "mobile" && controller.left.collapsed && !controller.left.previewed}
          <Button
            variant="ghost"
            class="beancount-shell__project-rail"
            aria-label={`Expand project rail: ${projectName}`}
            title={projectName}
            onclick={() => controller.left.expand()}
            ><span>{projectName}</span></Button
          >
        {:else}
          <AppShell.Sidebar.Header
            ><div class="beancount-project-banner" data-project-banner>
              <div class="beancount-project-banner__mark" aria-hidden="true">
                B
              </div>
              <div class="beancount-project-banner__identity">
                <p>Beancount Studio</p>
                <span data-project-name>{projectName}</span>
              </div>
              {#if onOpenSettings}<Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Project settings"
                  title="Ledger settings"
                  onclick={onOpenSettings}><Settings /></Button
                >{/if}
            </div></AppShell.Sidebar.Header
          >
          <AppShell.Sidebar.Body scrollable={false}
            >{@render navigation?.()}</AppShell.Sidebar.Body
          >
        {/if}
      </AppShell.Sidebar>
      <AppShell.Main
        ><AppShell.Toolbar label="Page toolbar"
          ><div
            class="beancount-shell__toolbar-leading"
            data-page-toolbar-leading
          >
            <strong class="beancount-shell__page-title">{title}</strong>
            {@render toolbarLeading?.()}
          </div>
          <div
            class="beancount-shell__toolbar-actions"
            data-page-toolbar-actions
          >
            {@render toolbar?.()}
          </div></AppShell.Toolbar
        ><AppShell.Body layout="regions"
          ><AppShell.Body.Content class="beancount-shell__content"
            >{@render content?.()}</AppShell.Body.Content
          ></AppShell.Body
        ></AppShell.Main
      >
      {#if details}<AppShell.Sidebar
          side="right"
          label="AI assistant"
          closeable
          resizable
          mobileLabel="Assistant"
          ><AppShell.Sidebar.Header
            ><strong>Assistant</strong><AppShell.Sidebar.Close
            /></AppShell.Sidebar.Header
          ><AppShell.Sidebar.Body>{@render details()}</AppShell.Sidebar.Body
          ></AppShell.Sidebar
        >{/if}
    </AppShell.Root>
  </div>
</div>

<style>
  .beancount-shell {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: 2.5rem minmax(0, 1fr);
    overflow: hidden;
  }
  .beancount-shell__header {
    display: flex;
    gap: 0.125rem;
    align-items: center;
    padding: 0.25rem 0.5rem;
    background: var(--sidebar, var(--muted));
  }
  .beancount-project-banner {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .beancount-project-banner__mark {
    display: grid;
    flex: none;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 0.375rem;
    background: var(--primary);
    color: var(--primary-foreground);
    font-weight: 600;
  }
  .beancount-project-banner__identity {
    flex: 1;
    min-width: 0;
  }
  .beancount-project-banner__identity p {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25;
  }
  .beancount-project-banner__identity span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  :global(.beancount-shell__surface [data-ui-part="toolbar"]) {
    padding-inline: 1rem;
    gap: 0.5rem;
  }
  .beancount-shell__toolbar-leading {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }
  .beancount-shell__page-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .beancount-shell__toolbar-actions {
    display: flex;
    flex: none;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
    margin-inline-start: auto;
  }
  :global(
      .beancount-shell__surface
        [data-ui-part="toolbar"]
        [data-ui-component="button"]
    ) {
    height: 2rem;
    min-height: 0;
    padding-block: 0;
    padding-inline: 0.625rem;
  }
  :global(
      .beancount-shell__surface
        [data-ui-part="toolbar"]
        [data-ui-component="button"][data-size^="icon"]
    ) {
    width: 2rem;
    padding: 0;
  }
  :global(.beancount-shell__content) {
    padding: 0;
  }
  .beancount-shell__stage {
    display: flex;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  :global(.beancount-shell__surface) {
    --ui-shell-height: 100%;
    flex: 1;
    min-height: 0;
  }
  :global(.beancount-shell__project-rail) {
    flex: 1;
    height: auto;
    min-height: 0;
    margin: 0.5rem 0.375rem;
    padding: 0.5rem 0.25rem;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    color: var(--sidebar-foreground);
    transition:
      border-color 150ms ease,
      background-color 150ms ease,
      color 150ms ease;
  }
  :global(.beancount-shell__project-rail:is(:hover, :focus-visible)) {
    border-color: var(--sidebar-border);
    background: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
  }
  :global(.beancount-shell__project-rail span) {
    writing-mode: vertical-rl;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :global(.beancount-shell__assistant-toggle) {
    margin-inline-start: auto;
  }
</style>
