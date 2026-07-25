<script lang="ts">
  import {
    Menubar as MenubarPrimitive,
    type WithoutChildrenOrChild,
  } from "bits-ui";
  import Check from "lucide-svelte/icons/check";
  import Minus from "lucide-svelte/icons/minus";
  import { cn } from "../../../lib/utils.js";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    indeterminate = $bindable(false),
    class: className,
    children: childrenProp,
    ...restProps
  }: WithoutChildrenOrChild<MenubarPrimitive.CheckboxItemProps> & {
    children?: Snippet;
  } = $props();
</script>

<MenubarPrimitive.CheckboxItem
  bind:ref
  bind:checked
  bind:indeterminate
  class={cn("cn-menubar-menubar-checkbox-item-28-1", className)}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-checkbox-item"
>
  {#snippet children({ checked, indeterminate })}
    <span class="cn-menubar-menubar-checkbox-item-34-1">
      {#if indeterminate}
        <Minus class="cn-menubar-menubar-checkbox-item-36-1" />
      {:else}
        <Check
          class={cn(
            "cn-menubar-menubar-checkbox-item-38-1",
            !checked && "cn-menubar-menubar-checkbox-item-38-2",
          )}
        />
      {/if}
    </span>
    {@render childrenProp?.()}
  {/snippet}
</MenubarPrimitive.CheckboxItem>
