<script lang="ts">
  import ChipAutocomplete from "./ChipAutocomplete.svelte";

  let {
    value = [],
    suggestions = [] as readonly string[],
    label = "Tags",
    showLabel = true,
    placeholder = "Add tag...",
    id = undefined,
    embedded = false,
    uppercase = true,
    onChange = () => {},
  }: {
    value?: readonly string[];
    suggestions?: readonly string[];
    label?: string;
    showLabel?: boolean;
    placeholder?: string;
    id?: string;
    embedded?: boolean;
    uppercase?: boolean;
    onChange?: (tags: string[]) => void | Promise<void>;
  } = $props();
</script>

<div class="tag-editor">
  <ChipAutocomplete
    {value}
    {suggestions}
    {label}
    {showLabel}
    {placeholder}
    {id}
    {embedded}
    {uppercase}
    {onChange}
  />
</div>

<style>
  .tag-editor :global(.chip) {
    border: 1px solid
      color-mix(in srgb, var(--primary) 72%, transparent);
    background: var(--primary);
    color: var(--primary-foreground);
  }

  .tag-editor :global(.chip button) {
    background: color-mix(
      in srgb,
      var(--primary-foreground) 18%,
      transparent
    );
    color: inherit;
  }
</style>
