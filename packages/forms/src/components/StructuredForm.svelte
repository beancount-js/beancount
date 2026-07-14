<script lang="ts" generics="TRoot, TContext = undefined">
  import type { FormConfig } from "../types";

  let {
    config,
    value,
    context,
    readonly = false,
    onChange,
  }: {
    config: FormConfig<TRoot, TContext>;
    value: TRoot;
    context: TContext;
    readonly?: boolean;
    onChange?: (value: TRoot) => void;
  } = $props();

  function update(field: FormConfig<TRoot, TContext>["fields"][number], next: string) {
    if (readonly || field.readonly || !field.set) return;
    onChange?.(field.set(value, next, context));
  }
</script>

<div class="structured-form">
  {#each config.fields as field (field.id)}
    <label>
      <span>{field.label}</span>
      {#if field.kind === "textarea"}
        <textarea
          value={field.get(value, context)}
          placeholder={field.placeholder}
          readonly={readonly || field.readonly}
          oninput={(event) => update(field, event.currentTarget.value)}
        ></textarea>
      {:else}
        <input
          value={field.format?.(field.get(value, context), value, context) ?? field.get(value, context)}
          placeholder={field.placeholder}
          readonly={readonly || field.readonly || field.kind === "readonly"}
          oninput={(event) => update(field, event.currentTarget.value)}
        />
      {/if}
      {#if field.description}<small>{field.description}</small>{/if}
    </label>
  {/each}
</div>

<style>
  .structured-form { display: grid; gap: .8rem; }
  label { display: grid; gap: .35rem; font-size: .85rem; color: var(--muted-foreground); }
  input, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: .55rem; padding: .55rem .65rem; background: var(--background); color: var(--foreground); font: inherit; }
  textarea { min-height: 5rem; resize: vertical; }
  small { font-size: .75rem; }
</style>
