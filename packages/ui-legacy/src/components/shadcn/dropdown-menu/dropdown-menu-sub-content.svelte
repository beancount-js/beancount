<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<DropdownMenuPrimitive.SubContent
  bind:ref
  class={cn("cn-dropdown-menu-dropdown-menu-sub-content-15-1", className)}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-sub-content"
/>
