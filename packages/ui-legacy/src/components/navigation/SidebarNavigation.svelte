<script lang="ts">
  import type { Icon } from "lucide-svelte";
  import * as Tooltip from "../shadcn/tooltip";
  import { buttonVariants } from "../shadcn/button";
  import { cn } from "../../lib/utils";

  export type SidebarNavigationItem = {
    label: string;
    href: string;
    icon: typeof Icon;
    badge?: string;
    disabled?: boolean;
  };

  /**
   * Keep navigation state in the parent so this component remains independent
   * from an application's router.
   */
  let {
    items,
    activeHref,
    ariaLabel = "Workspace navigation",
    onNavigate,
  }: {
    items: readonly SidebarNavigationItem[];
    activeHref?: string;
    ariaLabel?: string;
    onNavigate?: (href: string) => void;
  } = $props();

  function navigate(item: SidebarNavigationItem, event: MouseEvent): void {
    if (item.disabled || onNavigate) event.preventDefault();
    if (!item.disabled) onNavigate?.(item.href);
  }
</script>

<Tooltip.Provider>
  <nav class="cn-navigation-sidebarnavigation-38-1" aria-label={ariaLabel}>
    {#each items as item (item.href)}
      {@const active = item.href === activeHref}
      {@const Icon = item.icon}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <a
              {...props}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-disabled={item.disabled || undefined}
              class={cn(
                buttonVariants({
                  variant: "ghost",
                  size: "sm",
                }),
                "cn-navigation-sidebarnavigation-55-1",
                active
                  ? "cn-navigation-sidebarnavigation-57-1"
                  : "cn-navigation-sidebarnavigation-58-1",
                item.disabled && "cn-navigation-sidebarnavigation-59-1",
              )}
              onclick={(event) => navigate(item, event)}
            >
              <Icon
                class="cn-navigation-sidebarnavigation-64-1"
                aria-hidden="true"
              />
              <span class="cn-navigation-sidebarnavigation-67-1"
                >{item.label}</span
              >
              {#if item.badge}
                <span class="cn-navigation-sidebarnavigation-72-1">
                  {item.badge}
                </span>
              {/if}
            </a>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content
          side="right"
          class="cn-navigation-sidebarnavigation-80-1"
        >
          {item.label}
          {#if item.badge}
            <span class="cn-navigation-sidebarnavigation-83-1"
              >{item.badge}</span
            >
          {/if}
        </Tooltip.Content>
      </Tooltip.Root>
    {/each}
  </nav>
</Tooltip.Provider>
