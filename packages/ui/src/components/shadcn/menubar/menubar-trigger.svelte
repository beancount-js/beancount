<script lang="ts">
  import { Menubar as MenubarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: MenubarPrimitive.TriggerProps = $props();
</script>

<MenubarPrimitive.Trigger
  bind:ref
  class={cn("cn-menubar-menubar-trigger-15-1", className)}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-trigger"
/>
