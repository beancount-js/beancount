<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { buttonVariants } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import type { MenuItem } from "../menu";
  import { normalizePath, useNavigation } from "../router/router";

  export let items: Array<MenuItem>;

  const { isActive, router } = useNavigation();

  function navigate(path: string, event: MouseEvent) {
    event.preventDefault();
    router.updateState(normalizePath(path));
  }
</script>

<div class="flex flex-col gap-4">
  <nav class="grid gap-1 px-2">
    {#each items as item}
      {@const active = $isActive(item.path)}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <a
              {...props}
              href={item.path}
              class={cn(
                buttonVariants({
                  variant: "ghost",
                  size: "sm",
                }),
                "w-full justify-start border group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                active
                  ? "border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                  : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              onclick={(event) => navigate(item.path, event)}
            >
              <svelte:component
                this={item.icon}
                class="mr-2 size-4 group-data-[collapsible=icon]:mr-0"
                aria-hidden="true"
              />
              <span class="group-data-[collapsible=icon]:hidden"
                >{item.name}</span
              >
              {#if item.label}
                <span
                  class="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden"
                >
                  {item.label}
                </span>
              {/if}
            </a>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="right" class="flex items-center gap-4">
          {item.name}
          {#if item.label}
            <span class="ml-auto text-muted-foreground">{item.label}</span>
          {/if}
        </Tooltip.Content>
      </Tooltip.Root>
    {/each}
  </nav>
</div>
