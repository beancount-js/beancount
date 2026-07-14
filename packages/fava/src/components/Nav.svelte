<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { buttonVariants } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import type { MenuItem } from "../menu";
  import { normalizePath, useNavigation } from "../router/router";

  export let isCollapsed: boolean;
  export let items: Array<MenuItem>;

  const { isActive, router } = useNavigation();

  function navigate(path: string, event: MouseEvent) {
    event.preventDefault();
    router.updateState(normalizePath(path));
  }
</script>

<div
  data-collapsed={isCollapsed}
  class="group flex flex-col gap-4 data-[collapsed=true]:pb-2"
>
  <nav
    class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
  >
    {#each items as item}
      {@const active = $isActive(item.path)}
      {#if isCollapsed}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <a
                {...props}
                href={item.path}
                class={cn(
                  buttonVariants({
                    variant: "ghost",
                    size: "icon",
                  }),
                  "size-9 border",
                  active
                    ? "border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                    : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                onclick={(event) => navigate(item.path, event)}
              >
                <svelte:component
                  this={item.icon}
                  class="size-4"
                  aria-hidden="true"
                />
                <span class="sr-only">{item.name}</span>
              </a>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content side="right" class="flex items-center gap-4">
            {item.name}
            {#if item.label}
              <span class="ml-auto text-muted-foreground">
                {item.label}
              </span>
            {/if}
          </Tooltip.Content>
        </Tooltip.Root>
      {:else}
        <a
          href={item.path}
          class={cn(
            buttonVariants({
              variant: "ghost",
              size: "sm",
            }),
            "justify-start border",
            active
              ? "border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
              : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
          onclick={(event) => navigate(item.path, event)}
        >
          <svelte:component
            this={item.icon}
            class="mr-2 size-4"
            aria-hidden="true"
          />
          {item.name}
          {#if item.label}
            <span class="ml-auto text-muted-foreground">
              {item.label}
            </span>
          {/if}
        </a>
      {/if}
    {/each}
  </nav>
</div>
