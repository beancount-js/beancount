<script lang="ts">
  import ArrowDown from "lucide-svelte/icons/arrow-down";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import X from "lucide-svelte/icons/x";
  import type { Snippet } from "svelte";

  let {
    index,
    total,
    removeLabel = "Remove",
    onMove = () => {},
    onRemove = () => {},
    children,
  }: {
    index: number;
    total: number;
    removeLabel?: string;
    onMove?: (direction: -1 | 1) => void;
    onRemove?: () => void;
    children?: Snippet;
  } = $props();
</script>

<div class="beancount-form-entry-actions" data-testid="entry-header">
  <div class="beancount-form-entry-move" data-testid="entry-actions-move">
    <button
      type="button"
      disabled={index === 0}
      aria-label="Move up"
      onclick={() => onMove(-1)}
    >
      <ArrowUp />
    </button>
    <button
      type="button"
      disabled={index === total - 1}
      aria-label="Move down"
      onclick={() => onMove(1)}
    >
      <ArrowDown />
    </button>
  </div>

  <div class="beancount-form-entry-content">
    {@render children?.()}
  </div>

  <button
    type="button"
    class="beancount-form-entry-remove"
    aria-label={removeLabel}
    onclick={onRemove}
  >
    <X />
  </button>
</div>

<style>
  .beancount-form-entry-actions {
    position: relative;
  }

  .beancount-form-entry-content {
    min-width: 0;
  }

  .beancount-form-entry-move {
    position: absolute;
    top: 50%;
    left: -1.35rem;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    translate: 0 -50%;
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .beancount-form-entry-actions:hover .beancount-form-entry-move,
  .beancount-form-entry-actions:focus-within .beancount-form-entry-move,
  .beancount-form-entry-actions:hover .beancount-form-entry-remove,
  .beancount-form-entry-actions:focus-within .beancount-form-entry-remove {
    opacity: 1;
  }

  .beancount-form-entry-move button,
  .beancount-form-entry-remove {
    display: grid;
    width: 1rem;
    height: 1rem;
    place-items: center;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0;
  }

  .beancount-form-entry-move button:disabled {
    cursor: default;
    opacity: 0.28;
  }

  .beancount-form-entry-move button:hover,
  .beancount-form-entry-remove:hover,
  .beancount-form-entry-move button:focus-visible,
  .beancount-form-entry-remove:focus-visible {
    color: var(--foreground);
    outline: 0;
  }

  .beancount-form-entry-move :global(svg),
  .beancount-form-entry-remove :global(svg) {
    width: 0.75rem;
    height: 0.75rem;
  }

  .beancount-form-entry-remove {
    position: absolute;
    top: 50%;
    right: -1.35rem;
    translate: 0 -50%;
    opacity: 0;
    transition: opacity 140ms ease;
  }
</style>
