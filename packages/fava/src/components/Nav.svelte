<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import type { MenuItem } from "../menu";
  import { useNavigation } from "../router/router";

  export let isCollapsed: boolean;
  export let items: Array<MenuItem>;

  const { isActive } = useNavigation();
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
        <Tooltip.Root openDelay={0}>
          <Tooltip.Trigger asChild let:builder>
            <Button
              href={item.path}
              builders={[builder]}
              variant={active ? "default" : "ghost"}
              size="icon"
              class={cn("size-9")}
            >
              <svelte:component
                this={item.icon}
                class="size-4"
                aria-hidden="true"
              />
              <span class="sr-only size-4">{item.name}</span>
            </Button>
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
        <Button
          href={item.path}
          variant={active ? "default" : "ghost"}
          size="sm"
          class={cn("justify-start", {
            "hover:text-primary-foreground": active,
          })}
        >
          <svelte:component
            this={item.icon}
            class="mr-2 size-4"
            aria-hidden="true"
          />
          {item.name}
          {#if item.label}
            <span
              class={cn("ml-auto", {
                "text-background": active,
              })}
            >
              {item.label}
            </span>
          {/if}
        </Button>
      {/if}
    {/each}
  </nav>
</div>
