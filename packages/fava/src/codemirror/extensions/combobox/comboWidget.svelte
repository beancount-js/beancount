<script lang="ts">
  import Check from "lucide-svelte/icons/check";
  import Edit from "lucide-svelte/icons/edit";
  import { tick } from "svelte";
  import * as Command from "$lib/components/ui/command/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";
  import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";

  let {
    class: klass,
    items,
    value = "",
    onValueChange,
  }: {
    class?: string;
    items:
      | Array<{ label: string; value: string }>
      | (() => Array<{ label: string; value: string }>);
    value: string;
    onValueChange: (value: string) => void;
  } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement | null>(null);

  const options = $derived.by(() => {
    const list = Array.isArray(items) ? items : items();
    if (value && !list.some((item) => item.value === value)) {
      return [...list, { label: value, value }];
    }
    return list;
  });

  function selectItem(next: string) {
    onValueChange(next);
    open = false;
    void tick().then(() => triggerRef?.focus());
  }
</script>

{#if options.length > 1}
  <span class={cn("cm-account-combo cm-inactive-hide", klass)}>
    <Popover.Root bind:open>
      <Popover.Trigger bind:ref={triggerRef}>
        {#snippet child({ props })}
          <Button
            variant="ghost"
            size="icon"
            class="cm-account-combo__trigger size-5 text-muted-foreground hover:text-foreground"
            {...props}
            role="combobox"
            aria-expanded={open}
            aria-label={`Change account ${value}`}
            title="Change account"
          >
            <Edit class="size-3" />
            <span class="sr-only">{value}</span>
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-max p-0 text-xs" align="start" sideOffset={4}>
        <Command.Root>
          <Command.Input placeholder="Search accounts..." />
          <Command.List>
            <Command.Empty>No accounts found.</Command.Empty>
            <Command.Group>
              <ScrollArea class="h-[200px]">
                {#each options as item (item.value)}
                  <Command.Item
                    value={item.value}
                    class="w-full font-mono text-xs"
                    onSelect={() => selectItem(item.value)}
                  >
                    <Check
                      class={cn(
                        "mr-2 size-4",
                        value !== item.value && "text-transparent",
                      )}
                    />
                    {item.label}
                  </Command.Item>
                {/each}
              </ScrollArea>
            </Command.Group>
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  </span>
{/if}

<style>
  /* Zero horizontal width so CodeMirror does not wrap the line for the icon. */
  :global(.cm-account-combo-host) {
    display: inline-block;
    position: relative;
    width: 0;
    height: 1em;
    overflow: visible;
    vertical-align: text-bottom;
  }

  :global(.cm-account-combo) {
    position: absolute;
    left: 0.15rem;
    top: 50%;
    z-index: 1;
    display: block;
    width: max-content;
    transform: translateY(-50%);
  }

  :global(.cm-account-combo__trigger) {
    min-width: 1rem;
    width: 1rem;
    height: 1rem;
    padding: 0;
  }
</style>
