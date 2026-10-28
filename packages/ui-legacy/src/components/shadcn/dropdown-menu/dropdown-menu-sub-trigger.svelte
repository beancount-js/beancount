<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset = false,
    children,
    ...restProps
  }: DropdownMenuPrimitive.SubTriggerProps & {
    inset?: boolean;
  } = $props();
</script>

<DropdownMenuPrimitive.SubTrigger
  bind:ref
  class={cn(
    "cn-dropdown-menu-dropdown-menu-sub-trigger-20-1",
    inset && "cn-dropdown-menu-dropdown-menu-sub-trigger-21-1",
    className,
  )}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-sub-trigger"
>
  {@render children?.()}
  <ChevronRight class="cn-dropdown-menu-dropdown-menu-sub-trigger-27-1" />
</DropdownMenuPrimitive.SubTrigger>
