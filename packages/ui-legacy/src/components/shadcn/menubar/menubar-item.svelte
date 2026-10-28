<script lang="ts">
  import { Menubar as MenubarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    ...restProps
  }: MenubarPrimitive.ItemProps & {
    inset?: boolean;
  } = $props();
</script>

<MenubarPrimitive.Item
  bind:ref
  class={cn(
    "cn-menubar-menubar-item-18-1",
    inset && "cn-menubar-menubar-item-19-1",
    className,
  )}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-item"
/>
