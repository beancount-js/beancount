<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import Plus from "lucide-svelte/icons/plus";
  import type { Snippet } from "svelte";

  let {
    title,
    addLabel,
    count = 0,
    open = true,
    onToggle = () => {},
    onAdd = () => {},
    children,
  }: {
    title: string;
    addLabel: string;
    count?: number;
    open?: boolean;
    onToggle?: () => void;
    onAdd?: () => void;
    children?: Snippet;
  } = $props();
</script>

<section class="beancount-form-item-list">
  <header>
    <button
      type="button"
      class="beancount-form-item-list-toggle"
      aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
      aria-expanded={open}
      onclick={onToggle}
    >
      <ChevronDown />
      <span>{title}</span>
    </button>
    <small>{count}</small>
  </header>

  {#if open}
    <div class="beancount-form-item-list-body">
      {@render children?.()}
      <button
        type="button"
        class="beancount-form-item-list-add"
        onclick={onAdd}
      >
        <Plus />
        Add {addLabel}
      </button>
    </div>
  {/if}
</section>

<style>
  .beancount-form-item-list {
    display: grid;
    gap: 0.25rem;
  }

  .beancount-form-item-list > header {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    border-bottom: 1px solid
      var(--cv-form-border, var(--beancount-form-border, var(--border)));
    padding: 0 0 0.2rem;
  }

  .beancount-form-item-list-toggle,
  .beancount-form-item-list-add {
    display: inline-flex;
    align-items: center;
    border: 0;
    background: transparent;
    color: var(
      --cv-form-muted,
      var(--beancount-form-muted, var(--muted-foreground))
    );
    cursor: pointer;
    font: inherit;
    padding: 0;
  }

  .beancount-form-item-list-toggle {
    position: relative;
    min-width: 0;
    min-height: 1.5rem;
    justify-self: stretch;
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.5;
    text-align: left;
  }

  .beancount-form-item-list-toggle :global(svg) {
    position: absolute;
    top: 50%;
    left: -1.35rem;
    width: 0.75rem;
    height: 0.75rem;
    color: var(
      --cv-form-muted,
      var(--beancount-form-muted, var(--muted-foreground))
    );
    translate: 0 -50%;
  }

  .beancount-form-item-list-toggle[aria-expanded="false"] :global(svg) {
    rotate: -90deg;
  }

  .beancount-form-item-list > header > small {
    display: inline-flex;
    min-width: 1.35rem;
    height: 1.35rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(
      --cv-form-selection,
      var(
        --beancount-form-selection,
        color-mix(in srgb, var(--primary) 12%, transparent)
      )
    );
    color: var(--cv-form-accent, var(--beancount-form-accent, var(--primary)));
    font-size: 0.7rem;
    font-weight: 750;
  }

  .beancount-form-item-list-add {
    gap: 0.25rem;
    width: fit-content;
    font-size: 0.75rem;
    font-weight: 500;
    margin-top: 0.15rem;
  }

  .beancount-form-item-list-add :global(svg) {
    width: 0.8rem;
    height: 0.8rem;
  }

  .beancount-form-item-list-toggle:hover,
  .beancount-form-item-list-toggle:focus-visible,
  .beancount-form-item-list-add:hover,
  .beancount-form-item-list-add:focus-visible {
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    outline: 0;
  }

  .beancount-form-item-list-body {
    display: grid;
    gap: 0.35rem;
    padding-left: 1rem;
  }
</style>
