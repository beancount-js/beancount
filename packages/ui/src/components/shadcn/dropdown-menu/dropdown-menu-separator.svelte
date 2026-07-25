<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DropdownMenuPrimitive.SeparatorProps = $props();
</script>

<DropdownMenuPrimitive.Separator
  bind:ref
  class={cn("cn-dropdown-menu-dropdown-menu-separator-14-1", className)}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-separator"
/>
