<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import { Popover as PopoverPrimitive } from "bits-ui";

  let {
    ref = $bindable(null),
    class: className,
    align = "center",
    sideOffset = 4,
    portalProps,
    ...restProps
  }: PopoverPrimitive.ContentProps & {
    portalProps?: PopoverPrimitive.PortalProps;
  } = $props();
</script>

<PopoverPrimitive.Portal {...portalProps}>
  <PopoverPrimitive.Content
    bind:ref
    {align}
    {sideOffset}
    class={cn("cn-popover-popover-content-23-1", className)}
    {...restProps}
    data-ui-component="popover"
    data-ui-part="popover-content"
  />
</PopoverPrimitive.Portal>
