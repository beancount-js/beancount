<script lang="ts">
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import type { Snippet } from "svelte";

  let {
    collapsedAll,
    collapseLabel = "Collapse all",
    expandLabel = "Expand all",
    onToggleCollapse,
    actions,
    leading,
  }: {
    collapsedAll: boolean;
    collapseLabel?: string;
    expandLabel?: string;
    onToggleCollapse: () => void;
    actions?: Snippet;
    leading?: Snippet;
  } = $props();

  const toggleLabel = $derived(collapsedAll ? expandLabel : collapseLabel);
</script>

<div class="beancount-form-toolbar" data-testid="form-toolbar">
  <div class="beancount-form-toolbar-leading">
    {#if leading}
      {@render leading()}
    {/if}
    <button
      type="button"
      class="beancount-form-toolbar-collapse"
      aria-label={toggleLabel}
      title={toggleLabel}
      onclick={onToggleCollapse}
    >
      {#if collapsedAll}
        <ChevronsUpDown aria-hidden="true" />
      {:else}
        <ChevronsDownUp aria-hidden="true" />
      {/if}
    </button>
  </div>

  {#if actions}
    <div class="beancount-form-toolbar-actions">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .beancount-form-toolbar {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-inline: 0.15rem;
  }

  .beancount-form-toolbar-leading {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.35rem;
  }

  .beancount-form-toolbar-collapse {
    display: grid;
    width: 1.5rem;
    height: 1.5rem;
    place-items: center;
    flex-shrink: 0;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0;
  }

  .beancount-form-toolbar-collapse:hover,
  .beancount-form-toolbar-collapse:focus-visible {
    color: var(--foreground);
    outline: 0;
  }

  .beancount-form-toolbar-collapse :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .beancount-form-toolbar-actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.35rem;
  }
</style>
