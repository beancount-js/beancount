<script lang="ts">
  import Check from "lucide-svelte/icons/check";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import { tick, type Snippet } from "svelte";
  import * as Command from "$lib/components/ui/command/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import { type Icon as IconType } from "lucide-svelte";
  import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";

  type ComboProps = {
    class?: string;
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
    items:
      | Array<{ label: string; value: string }>
      | (() => Array<{ label: string; value: string }>);
    groups?: Array<{
      group: string;
      items: Array<{ label: string; value: string; icon?: typeof IconType }>;
    }>;
    value: string;
    placeholder?: string;
    onValueChange: (value: string) => void;
  };

  let {
    trigger,
    class: klass,
    items: options,
    value: selected = "",
    groups = [],
    placeholder = "Select",
    onValueChange = () => {},
  }: ComboProps = $props();

  let items = $derived.by(() => {
    const values: Array<{ label: string; value: string }> = [];
    if (Array.isArray(options)) {
      values.push(...options);
    } else {
      values.push(...options());
    }
    if (selected && !values.find((it) => it.value === selected)) {
      values.push({ label: selected, value: selected });
    }
    return values;
  });

  let open = $state(false);
  let value = $state(selected);
  let triggerRef = $state<HTMLButtonElement>(null!);

  const selectedValue = $derived(items.find((f) => f.value === value)?.label);

  // We want to refocus the trigger button when the user selects
  // an item from the list so users can continue navigating the
  // rest of the form with the keyboard.
  function closeAndFocusTrigger() {
    open = false;
    tick().then(() => {
      triggerRef.focus();
    });
  }
</script>

<div class={klass}>
  <Popover.Root bind:open>
    <Popover.Trigger bind:ref={triggerRef}>
      {#snippet child({ props })}
        {#if trigger}
          {@render trigger({ props: { ...props, value: selectedValue } })}
        {:else}
          <Button
            variant="outline"
            class="text-mono w-full justify-between text-xs"
            {...props}
            role="combobox"
            size="sm"
            aria-expanded={open}
          >
            <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        {/if}
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-max p-0 text-xs">
      <Command.Root>
        <Command.Input placeholder="Search ..." />
        <Command.List>
          <Command.Empty>No items found.</Command.Empty>
          {#each groups as group}
            <Command.Group heading={group.group} class="">
              {#each group.items as item}
                <Command.Item
                  class="text-mono w-full font-mono text-xs"
                  value={item.value}
                  onSelect={() => {
                    value = item.value;
                    closeAndFocusTrigger();
                    onValueChange(item.value);
                  }}
                >
                  {#if value !== item.value && item.icon}
                    {@const Icon = item.icon}
                    <Icon class="mr-2 h-4 w-4" />
                  {:else}
                    <Check
                      class={cn(
                        "mr-2 h-4 w-4",
                        value !== item.value && "text-transparent",
                      )}
                    />
                  {/if}
                  {item.label}
                </Command.Item>
              {/each}
            </Command.Group>
            <Command.Separator></Command.Separator>
          {/each}
          <Command.Group>
            <ScrollArea class="h-[200px]">
              {#each items as item}
                <Command.Item
                  value={item.value}
                  class="w-full font-mono text-xs"
                  onSelect={() => {
                    value = item.value;
                    onValueChange(item.value);
                    closeAndFocusTrigger();
                  }}
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
</div>
