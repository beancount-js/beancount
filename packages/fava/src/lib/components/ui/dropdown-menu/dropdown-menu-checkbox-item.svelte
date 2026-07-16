<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import Check from "lucide-svelte/icons/check";
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    class: className,
    children: childrenProp,
    ...restProps
  }: Omit<DropdownMenuPrimitive.CheckboxItemProps, "children"> & {
    children?: Snippet;
  } = $props();
</script>

<DropdownMenuPrimitive.CheckboxItem
  bind:ref
  bind:checked
  class={cn(
    "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    className,
  )}
  {...restProps}
>
  {#snippet children({ checked })}
    <span class="absolute left-2 flex size-3.5 items-center justify-center">
      {#if checked}
        <Check class="size-4" />
      {/if}
    </span>
    {@render childrenProp?.()}
  {/snippet}
</DropdownMenuPrimitive.CheckboxItem>
