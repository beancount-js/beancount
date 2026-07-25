<script lang="ts">
  import { Menubar as MenubarPrimitive, type WithoutChild } from "bits-ui";
  import Circle from "lucide-svelte/icons/circle";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children: childrenProp,
    ...restProps
  }: WithoutChild<MenubarPrimitive.RadioItemProps> = $props();
</script>

<MenubarPrimitive.RadioItem
  bind:ref
  class={cn("cn-menubar-menubar-radio-item-17-1", className)}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-radio-item"
>
  {#snippet children({ checked })}
    <span class="cn-menubar-menubar-radio-item-23-1">
      {#if checked}
        <Circle class="cn-menubar-menubar-radio-item-25-1" />
      {/if}
    </span>
    {@render childrenProp?.({ checked })}
  {/snippet}
</MenubarPrimitive.RadioItem>
