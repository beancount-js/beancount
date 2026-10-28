<script lang="ts">
  import { Menubar as MenubarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: MenubarPrimitive.SubContentProps = $props();
</script>

<MenubarPrimitive.SubContent
  bind:ref
  class={cn("cn-menubar-menubar-sub-content-15-1", className)}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-sub-content"
/>
