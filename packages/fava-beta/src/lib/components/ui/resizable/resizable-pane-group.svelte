<script lang="ts">
  import * as ResizablePrimitive from "paneforge";
  import { cn } from "$lib/utils.js";

  type $$Props = ResizablePrimitive.PaneGroupProps;

  let className: $$Props["class"] = undefined;
  export let direction: $$Props["direction"];
  export { className as class };
</script>

<ResizablePrimitive.PaneGroup
  {direction}
  class={cn("flex h-full w-full data-[direction=vertical]:flex-col", className)}
  {...$$restProps}
>
  <slot />
</ResizablePrimitive.PaneGroup>
