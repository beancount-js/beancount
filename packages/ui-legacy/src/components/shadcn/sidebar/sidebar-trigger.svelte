<script lang="ts">
  import { Button } from "../button/index.js";
  import { cn } from "../../../lib/utils.js";
  import PanelLeft from "lucide-svelte/icons/panel-left";
  import type { ComponentProps, Snippet } from "svelte";
  import { useSidebar } from "./context.svelte.js";

  let {
    ref = $bindable(null),
    class: className,
    onclick,
    children,
    ...restProps
  }: ComponentProps<typeof Button> & {
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  } = $props();

  const sidebar = useSidebar();
</script>

<Button
  type="button"
  onclick={(e) => {
    onclick?.(e);
    sidebar.toggle();
  }}
  data-sidebar="trigger"
  variant="ghost"
  size="icon"
  class={cn("cn-sidebar-sidebar-trigger-31-1", className)}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-trigger"
>
  {#if children}
    {@render children()}
  {:else}
    <PanelLeft />
    <span class="sr-only">Toggle Sidebar</span>
  {/if}
</Button>
