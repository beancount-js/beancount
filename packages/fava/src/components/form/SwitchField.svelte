<script lang="ts">
  import type { FormFieldRenderArgs } from "@beancount-js/forms";
  import { Switch } from "$lib/components/ui/switch";

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
