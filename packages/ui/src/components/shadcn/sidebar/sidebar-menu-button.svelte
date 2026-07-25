<script lang="ts" module>
  import {
    createVariants,
    type VariantProps,
  } from "../../../lib/semantic-variants.js";

  export const sidebarMenuButtonVariants = createVariants({
    base: "cn-sidebar-sidebar-menu-button-5-1 cn-peer-menu-button",
    variants: {
      variant: {
        default: "cn-sidebar-sidebar-menu-button-8-1",
        outline: "cn-sidebar-sidebar-menu-button-10-1",
      },
      size: {
        default: "cn-sidebar-sidebar-menu-button-13-1",
        sm: "cn-sidebar-sidebar-menu-button-14-1",
        lg: "cn-sidebar-sidebar-menu-button-15-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  });

  export type SidebarMenuButtonVariant = VariantProps<
    typeof sidebarMenuButtonVariants
  >["variant"];
  export type SidebarMenuButtonSize = VariantProps<
    typeof sidebarMenuButtonVariants
  >["size"];
</script>

<script lang="ts">
  import * as Tooltip from "../tooltip/index.js";
  import { cn } from "../../../lib/utils.js";
  import {
    mergeProps,
    type WithElementRef,
    type WithoutChildrenOrChild,
  } from "bits-ui";
  import type { ComponentProps, Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { useSidebar } from "./context.svelte.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    child,
    variant = "default",
    size = "default",
    isActive = false,
    tooltipContent,
    tooltipContentProps,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & {
    isActive?: boolean;
    variant?: SidebarMenuButtonVariant;
    size?: SidebarMenuButtonSize;
    tooltipContent?: Snippet;
    tooltipContentProps?: WithoutChildrenOrChild<
      ComponentProps<typeof Tooltip.Content>
    >;
    child?: Snippet<[{ props: Record<string, unknown> }]>;
  } = $props();

  const sidebar = useSidebar();

  const buttonProps = $derived({
    class: cn(sidebarMenuButtonVariants({ variant, size }), className),
    "data-sidebar": "menu-button",
    "data-size": size,
    "data-active": isActive,
    ...restProps,
  });
</script>

{#snippet Button({ props }: { props?: Record<string, unknown> })}
  {@const mergedProps = mergeProps(buttonProps, props)}
  {#if child}
    {@render child({ props: mergedProps })}
  {:else}
    <button
      bind:this={ref}
      {...mergedProps}
      data-ui-component="sidebar"
      data-ui-part="sidebar-menu-button"
    >
      {@render children?.()}
    </button>
  {/if}
{/snippet}

{#if !tooltipContent}
  {@render Button({})}
{:else}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {@render Button({ props })}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content
      side="right"
      align="center"
      hidden={sidebar.state !== "collapsed" || sidebar.isMobile}
      children={tooltipContent}
      {...tooltipContentProps}
    />
  </Tooltip.Root>
{/if}
