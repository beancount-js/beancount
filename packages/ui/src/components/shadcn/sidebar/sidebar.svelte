<script lang="ts">
  import * as Sheet from "../sheet/index.js";
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { SIDEBAR_WIDTH_MOBILE } from "./constants.js";
  import { useSidebar } from "./context.svelte.js";

  let {
    ref = $bindable(null),
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    showBorder = true,
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
    showBorder?: boolean;
  } = $props();

  const sidebar = useSidebar();
</script>

{#if collapsible === "none"}
  <div
    class={cn("cn-sidebar-sidebar-31-1", className)}
    bind:this={ref}
    {...restProps}
    data-ui-component="sidebar"
    data-ui-part="sidebar"
  >
    {@render children?.()}
  </div>
{:else if sidebar.isMobile}
  <Sheet.Root
    open={sidebar.openMobile}
    onOpenChange={sidebar.setOpenMobile}
    {...restProps}
  >
    <Sheet.Content
      data-sidebar="sidebar"
      data-mobile="true"
      class="cn-sidebar-sidebar-48-1"
      style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE};"
      {side}
    >
      <div class="cn-sidebar-sidebar-52-1">
        {@render children?.()}
      </div>
    </Sheet.Content>
  </Sheet.Root>
{:else}
  <div
    bind:this={ref}
    class="cn-sidebar-sidebar-60-1 cn-group cn-peer"
    data-state={sidebar.state}
    data-collapsible={sidebar.state === "collapsed" ? collapsible : ""}
    data-variant={variant}
    data-side={side}
  >
    <!-- This is what handles the sidebar gap on desktop -->
    <div
      class={cn(
        "cn-sidebar-sidebar-69-1",
        "cn-sidebar-sidebar-70-1",
        "cn-sidebar-sidebar-71-1",
        variant === "floating" || variant === "inset"
          ? "cn-sidebar-sidebar-73-1"
          : "cn-sidebar-sidebar-74-1",
      )}
    ></div>
    <div
      class={cn(
        "cn-sidebar-sidebar-79-1",
        side === "left" ? "cn-sidebar-sidebar-81-1" : "cn-sidebar-sidebar-82-1",
        // Adjust the padding for floating and inset variants.
        variant === "floating" || variant === "inset"
          ? "cn-sidebar-sidebar-85-1"
          : cn(
              "cn-sidebar-sidebar-87-1",
              showBorder && "cn-sidebar-sidebar-89-1",
            ),
        className,
      )}
      {...restProps}
    >
      <div data-sidebar="sidebar" class="cn-sidebar-sidebar-97-1">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
