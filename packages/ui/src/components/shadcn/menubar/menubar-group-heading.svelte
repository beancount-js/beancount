<script lang="ts">
  import { Menubar as MenubarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    ...restProps
  }: MenubarPrimitive.GroupHeadingProps & {
    inset?: boolean;
  } = $props();
</script>

<MenubarPrimitive.GroupHeading
  bind:ref
  class={cn(
    "cn-menubar-menubar-group-heading-17-1",
    inset && "cn-menubar-menubar-group-heading-17-2",
    className,
  )}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-group-heading"
/>
