<script lang="ts">
  import { Menubar as MenubarPrimitive } from "bits-ui";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    children,
    ...restProps
  }: MenubarPrimitive.SubTriggerProps & {
    inset?: boolean;
  } = $props();
</script>

<MenubarPrimitive.SubTrigger
  bind:ref
  class={cn(
    "cn-menubar-menubar-sub-trigger-20-1",
    inset && "cn-menubar-menubar-sub-trigger-21-1",
    className,
  )}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-sub-trigger"
>
  {@render children?.()}
  <ChevronRight class="cn-menubar-menubar-sub-trigger-27-1" />
</MenubarPrimitive.SubTrigger>
