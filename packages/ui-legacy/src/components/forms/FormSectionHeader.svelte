<script lang="ts">
  import ArrowDown from "lucide-svelte/icons/arrow-down";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import X from "lucide-svelte/icons/x";
  import type { Snippet } from "svelte";

  import { autosizeTextarea } from "./autosize-textarea";

  let {
    title,
    disclosureTitle = title,
    index = 0,
    total = 1,
    open = true,
    editable = true,
    movable = true,
    removable = true,
    titleToggleable = false,
    removeLabel = "Delete section",
    titleClass = "",
    titleLabel = "Section title",
    titlePlaceholder = "",
    titleRowClass = "",
    onTitleChange = () => {},
    onMove = () => {},
    onRemove = () => {},
    onToggle = () => {},
    titleContent,
    actions,
  }: {
    title: string;
    disclosureTitle?: string;
    index?: number;
    total?: number;
    open?: boolean;
    editable?: boolean;
    movable?: boolean;
    removable?: boolean;
    titleToggleable?: boolean;
    removeLabel?: string;
    titleClass?: string;
    titleLabel?: string;
    titlePlaceholder?: string;
    titleRowClass?: string;
    onTitleChange?: (value: string) => void;
    onMove?: (direction: -1 | 1) => void;
    onRemove?: () => void;
    onToggle?: () => void;
    titleContent?: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<div class="beancount-form-section-header">
  {#if movable}
    <div class="beancount-form-section-move" data-testid="section-actions-move">
      <button
        type="button"
        disabled={index === 0}
        aria-label="Move section up"
        onclick={() => onMove(-1)}
      >
        <ArrowUp />
      </button>
      <button
        type="button"
        disabled={index === total - 1}
        aria-label="Move section down"
        onclick={() => onMove(1)}
      >
        <ArrowDown />
      </button>
    </div>
  {/if}

  <button
    type="button"
    class="beancount-form-section-toggle"
    aria-label={open
      ? `Collapse ${disclosureTitle}`
      : `Expand ${disclosureTitle}`}
    aria-expanded={open}
    onclick={onToggle}
  >
    <ChevronDown />
  </button>

  <div class={`beancount-form-section-title-row ${titleRowClass}`}>
    {#if titleContent}
      <div class="beancount-form-section-title-slot">
        {@render titleContent()}
      </div>
    {:else if editable}
      <textarea
        aria-label={titleLabel}
        class={titleClass}
        placeholder={titlePlaceholder}
        rows="1"
        use:autosizeTextarea={title}
        value={title}
        oninput={(event) => onTitleChange(event.currentTarget.value)}
      ></textarea>
    {:else if titleToggleable}
      <button
        type="button"
        class={`beancount-form-section-title-toggle ${titleClass}`}
        aria-expanded={open}
        onclick={onToggle}
      >
        {title}
      </button>
    {:else}
      <h3 class={titleClass}>{title}</h3>
    {/if}

    {#if actions}
      <div class="beancount-form-section-actions">
        {@render actions()}
      </div>
    {/if}
  </div>

  {#if removable}
    <button
      type="button"
      class="beancount-form-section-remove"
      aria-label={removeLabel}
      onclick={onRemove}
    >
      <X />
    </button>
  {/if}
</div>

<style>
  .beancount-form-section-header {
    position: relative;
  }

  .beancount-form-section-move {
    position: absolute;
    top: 50%;
    left: -2.35rem;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    translate: 0 -50%;
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .beancount-form-section-header:hover .beancount-form-section-move,
  .beancount-form-section-header:focus-within .beancount-form-section-move,
  .beancount-form-section-header:hover .beancount-form-section-remove,
  .beancount-form-section-header:focus-within .beancount-form-section-remove {
    opacity: 1;
  }

  .beancount-form-section-move button,
  .beancount-form-section-remove,
  .beancount-form-section-toggle {
    display: grid;
    width: 1.25rem;
    height: 1.25rem;
    place-items: center;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: var(
      --cv-form-muted,
      var(--beancount-form-muted, var(--muted-foreground))
    );
    cursor: pointer;
    padding: 0;
  }

  .beancount-form-section-move button {
    width: 1rem;
    height: 1rem;
  }

  .beancount-form-section-toggle {
    position: absolute;
    top: 50%;
    left: -1.35rem;
    z-index: 1;
    translate: 0 -50%;
  }

  .beancount-form-section-move button:disabled {
    cursor: default;
    opacity: 0.28;
  }

  .beancount-form-section-move button:hover,
  .beancount-form-section-remove:hover,
  .beancount-form-section-toggle:hover,
  .beancount-form-section-move button:focus-visible,
  .beancount-form-section-remove:focus-visible,
  .beancount-form-section-toggle:focus-visible {
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    outline: 0;
  }

  .beancount-form-section-move :global(svg),
  .beancount-form-section-remove :global(svg),
  .beancount-form-section-toggle :global(svg) {
    width: 0.75rem;
    height: 0.75rem;
  }

  .beancount-form-section-toggle[aria-expanded="false"] :global(svg) {
    rotate: -90deg;
  }

  .beancount-form-section-title-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.3rem;
    align-items: center;
    border-bottom: 1px solid
      var(
        --cv-form-border-muted,
        color-mix(
          in srgb,
          var(--beancount-form-muted, var(--muted-foreground)) 42%,
          transparent
        )
      );
    padding-bottom: 0.2rem;
  }

  .beancount-form-section-title-slot {
    min-width: 0;
  }

  .beancount-form-section-title-row textarea {
    min-height: 1.5rem;
    resize: none;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.5;
    padding: 0;
    white-space: normal;
  }

  .beancount-form-section-title-row textarea:focus,
  .beancount-form-section-title-row textarea:focus-visible {
    outline: 0;
    box-shadow: none;
  }

  .beancount-form-section-title-row h3 {
    min-height: 1.5rem;
    display: flex;
    align-items: center;
    margin: 0;
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    line-height: 1.5;
    padding: 0;
  }

  .beancount-form-section-title-toggle {
    min-height: 1.5rem;
    display: flex;
    align-items: center;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    cursor: pointer;
    font: inherit;
    line-height: 1.5;
    padding: 0;
    text-align: left;
  }

  /* Low specificity so titleClass utilities (e.g. text-xs) can override. */
  :where(.beancount-form-section-title-row h3),
  :where(.beancount-form-section-title-toggle) {
    font-size: 1rem;
    font-weight: 600;
  }

  .beancount-form-section-title-toggle:hover,
  .beancount-form-section-title-toggle:focus-visible {
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    outline: 0;
  }

  .beancount-form-section-actions {
    min-width: 0;
  }

  .beancount-form-section-remove {
    position: absolute;
    top: 50%;
    right: -1.35rem;
    translate: 0 -50%;
    opacity: 0;
    transition: opacity 140ms ease;
  }
</style>
