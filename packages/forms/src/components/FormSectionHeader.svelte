<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    open = true,
    actions,
    onToggle = () => {},
  }: {
    title: string;
    open?: boolean;
    actions?: Snippet;
    onToggle?: () => void;
  } = $props();
</script>

<div class="beancount-form-section-header">
  <button
    type="button"
    class="beancount-form-section-disclosure"
    aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
    aria-expanded={open}
    onclick={onToggle}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="m4 6 4 4 4-4"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  </button>
  <div class="beancount-form-section-title-row">
    <button
      type="button"
      class="beancount-form-section-title"
      aria-expanded={open}
      onclick={onToggle}
    >
      {title}
    </button>
    {#if actions}
      <div class="beancount-form-section-actions">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>

<style>
  .beancount-form-section-header {
    position: relative;
  }

  .beancount-form-section-disclosure {
    position: absolute;
    top: 50%;
    left: -1.35rem;
    z-index: 1;
    display: grid;
    width: 1.25rem;
    height: 1.25rem;
    place-items: center;
    translate: 0 -50%;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0;
  }

  .beancount-form-section-disclosure svg {
    width: 0.75rem;
    height: 0.75rem;
    transition: rotate 140ms ease;
  }

  .beancount-form-section-disclosure[aria-expanded="false"] svg {
    rotate: -90deg;
  }

  .beancount-form-section-disclosure:hover,
  .beancount-form-section-disclosure:focus-visible,
  .beancount-form-section-title:hover,
  .beancount-form-section-title:focus-visible {
    color: var(--foreground);
    outline: 0;
  }

  .beancount-form-section-title-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.3rem;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.2rem;
  }

  .beancount-form-section-title {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 1.5rem;
    border: 0;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.5;
    padding: 0;
    text-align: left;
  }

  .beancount-form-section-actions {
    min-width: 0;
  }
</style>
