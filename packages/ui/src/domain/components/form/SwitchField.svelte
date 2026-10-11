<script lang="ts">
  import type { FormFieldRenderArgs } from "@lapismd/design-core/forms";
  import { Switch } from "@lapismd/design-core/shadcn/switch";

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
