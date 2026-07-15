<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    align = "start",
    as = "label",
    controlId,
    invalid = false,
    messages = [],
    children,
  }: {
    label: string;
    align?: "start" | "center";
    as?: "label" | "div";
    controlId?: string;
    invalid?: boolean;
    messages?: string[];
    children?: Snippet;
  } = $props();

  const labelId = `beancount-form-field-${Math.random().toString(36).slice(2, 10)}`;
</script>

{#if as === "div"}
  <div
    class="beancount-form-field"
    data-align={align}
    data-control-id={controlId}
    data-invalid={invalid || undefined}
    role="group"
    aria-labelledby={labelId}
  >
    <span id={labelId}>{label}</span>
    <div class="beancount-form-field-control">
      {@render children?.()}
      {#if messages.length}
        <ul class="beancount-form-field-messages" aria-live="polite">
          {#each messages as message}
            <li>{message}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{:else}
  <label
    class="beancount-form-field"
    data-align={align}
    data-control-id={controlId}
    data-invalid={invalid || undefined}
  >
    <span>{label}</span>
    <div class="beancount-form-field-control">
      {@render children?.()}
      {#if messages.length}
        <ul class="beancount-form-field-messages" aria-live="polite">
          {#each messages as message}
            <li>{message}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </label>
{/if}

<style>
  :global(.beancount-structured-form) {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    column-gap: var(--beancount-form-control-column-gap, 1rem);
    min-width: 0;
  }

  .beancount-form-field {
    --beancount-form-control-column-gap: 1rem;
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    column-gap: var(--beancount-form-control-column-gap);
    row-gap: 0;
    align-items: start;
    border-bottom: 1px solid var(--border);
  }

  @supports (grid-template-columns: subgrid) {
    :global(.beancount-structured-form) > .beancount-form-field {
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      column-gap: var(--beancount-form-control-column-gap);
    }
  }

  .beancount-form-field[data-align="center"] {
    align-items: stretch;
  }

  .beancount-form-field > span {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    font-weight: 500;
    padding-top: 0.45rem;
  }

  .beancount-form-field[data-align="center"] > span {
    display: flex;
    align-items: center;
    min-height: 2.65rem;
    padding-top: 0;
  }

  .beancount-form-field-control {
    min-width: 0;
  }

  .beancount-form-field-messages {
    margin: 0.25rem 0 0;
    padding: 0;
    color: var(--destructive);
    font-size: 0.75rem;
    list-style: none;
  }

  .beancount-form-field[data-align="center"] .beancount-form-field-control {
    display: flex;
    align-items: center;
    min-height: 2.65rem;
    box-sizing: border-box;
    padding-block: 0.35rem;
  }

  .beancount-form-field-control :global(input),
  .beancount-form-field-control :global(textarea) {
    width: 100%;
    min-width: 0;
    border: 0;
    border-radius: 0;
    border-bottom: 0;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    line-height: 1.45;
    padding: 0.35rem 0;
  }

  .beancount-form-field-control :global(textarea) {
    min-height: 1.8rem;
    overflow: hidden;
    resize: none;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .beancount-form-field-control :global(input:focus),
  .beancount-form-field-control :global(input:focus-visible),
  .beancount-form-field-control :global(textarea:focus),
  .beancount-form-field-control :global(textarea:focus-visible) {
    outline: 0;
    box-shadow: none;
  }

  @media (max-width: 720px) {
    .beancount-form-field,
    :global(.beancount-structured-form) > .beancount-form-field {
      grid-column: auto;
      grid-template-columns: 1fr;
      row-gap: 0.25rem;
    }
  }
</style>
