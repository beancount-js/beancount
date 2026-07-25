<script lang="ts">
  import { Menubar as MenubarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 8,
    alignOffset = -4,
    align = "start",
    side = "bottom",
    portalProps,
    ...restProps
  }: MenubarPrimitive.ContentProps & {
    portalProps?: MenubarPrimitive.PortalProps;
  } = $props();
</script>

<MenubarPrimitive.Portal {...portalProps}>
  <MenubarPrimitive.Content
    bind:ref
    {sideOffset}
    {align}
    {alignOffset}
    {side}
    class={cn("cn-menubar-menubar-content-27-1", className)}
    {...restProps}
    data-ui-component="menubar"
    data-ui-part="menubar-content"
  />
</MenubarPrimitive.Portal>
