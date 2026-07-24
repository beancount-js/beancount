<script lang="ts">
  import Switch from "./Switch.svelte";
  import type { FormFieldRenderArgs } from "./types";

  let {
    value,
    field,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, unknown, boolean> = $props();
</script>

{#if readonly}
  <output>{value ? "Yes" : "No"}</output>
{:else}
  <Switch
    size="sm"
    checked={value === true}
    aria-label={field.ariaLabel ?? field.label}
    onCheckedChange={(next) => void update(next)}
  />
{/if}
