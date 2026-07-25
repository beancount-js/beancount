<script lang="ts">
  import { Menubar as MenubarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: MenubarPrimitive.SeparatorProps = $props();
</script>

<MenubarPrimitive.Separator
  bind:ref
  class={cn("cn-menubar-menubar-separator-14-1", className)}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-separator"
/>
