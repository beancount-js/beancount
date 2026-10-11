<script lang="ts">
  import {
    AppShell,
    type AppShellController,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import type { Snippet } from "svelte";
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
    toolbar,
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
    toolbar?: Snippet;
  } = $props();
</script>

<div
  class="beancount-shell"
  data-mobile={controller.mobile.resolvedMode === "mobile"}
>
  <nav aria-label="Application navigation" class="beancount-shell__header">
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={controller.left.collapsed
        ? "Expand left sidebar"
        : "Collapse left sidebar"}
      aria-expanded={!controller.left.collapsed}
      onclick={() => controller.left.toggle()}
      ><PanelLeft aria-hidden="true" /></Button
    >
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
    <span class="beancount-shell__name">Beancount Studio</span>
    {#if details}<Button
        variant="ghost"
        size="icon-sm"
        aria-label="Toggle AI panel"
        aria-expanded={!controller.right.closed}
        onclick={() =>
          controller.right.closed
            ? controller.right.open()
            : controller.right.close()}
        ><PanelRight aria-hidden="true" /></Button
      >{/if}
  </nav>
  <AppShell.Root {controller} {displayMode} mobileBreakpoint={1024}>
    <AppShell.Sidebar
      side="left"
      label="Ledger navigation"
      resizable
      mobileLabel="Navigation"
      ><AppShell.Sidebar.Header
        ><strong>Beancount Studio</strong></AppShell.Sidebar.Header
      ><AppShell.Sidebar.Body>{@render navigation?.()}</AppShell.Sidebar.Body
      ></AppShell.Sidebar
    >
    <AppShell.Main
      ><AppShell.Toolbar label="Page toolbar"
        ><strong>{title}</strong>{@render toolbar?.()}</AppShell.Toolbar
      ><AppShell.Body layout="regions"
        ><AppShell.Body.Content>{@render content?.()}</AppShell.Body.Content
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
    background: var(--muted);
  }
  .beancount-shell__name {
    flex: 1;
    font-size: 0.875rem;
    padding-inline: 0.5rem;
  }
  .beancount-shell[data-mobile="true"] {
    grid-template-rows: minmax(0, 1fr);
  }
  .beancount-shell[data-mobile="true"] .beancount-shell__header {
    display: none;
  }
</style>
