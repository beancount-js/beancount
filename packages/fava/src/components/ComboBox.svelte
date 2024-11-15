<script lang="ts">
    import { ArrowUpDown, Check, Icon } from "lucide-svelte"
    import { tick, type ComponentType } from "svelte";
    import * as Command from "$lib/components/ui/command/index.js";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { cn } from "$lib/utils.js";
    import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";
    
    let className: string | undefined | null = undefined;
	export { className as class };

    let itemInput: Array<{label: string; value: string;}> | (() => Array<{label: string; value: string;}>);
    export { itemInput as items };

    export let groups: Array<{group: string, items: Array<{label: string, value: string, icon?: ComponentType<Icon>}>}> = [];

    let open = false;
    export let value = "";
    export let placeholder = "Select";
    export let onValueChange: (value: string) => void = () => {};

    $: itemFetcher = () => {
        const values: Array<{label: string; value: string;}> = [];
        if (Array.isArray(itemInput)) {
            values.push(...itemInput);
        } else {
            values.push(...itemInput()); 
        }
      
        if (value && !values.find(it => it.value === value)) {
            values.push({label: value, value});
        }
        return values; 
    };

    $: items = itemFetcher();
    $: selected = items.find((f) => f.value === value)
    $: selectedValue = selected?.label ?? placeholder; 
    
    // We want to refocus the trigger button when the user selects
    // an item from the list so users can continue navigating the
    // rest of the form with the keyboard.
    function closeAndFocusTrigger(triggerId: string) {
     open = false;
     tick().then(() => {
      document.getElementById(triggerId)?.focus();
     });
    }
</script>

<div class={className}>
   <Popover.Root bind:open let:ids>
    <Popover.Trigger asChild let:builder>
     <slot name="trigger" builder={builder} open={open} selected={selected} value={selectedValue}>
        <Button
            builders={[builder]}
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            class="w-full justify-between text-xs text-mono"
        >
            {selectedValue}
            <ArrowUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
     </slot>
    </Popover.Trigger>
    <Popover.Content class="pt-2 border-divider border border-solid z-[1000]">
     <Command.Root>
      <Command.Input placeholder="Search ..." class="h-9 !shadow-none" />
      <Command.Empty>No items found.</Command.Empty>
      {#each groups as group}
      <Command.Group heading={group.group}  class="">
        {#each group.items as item}
        <Command.Item
         class="text-xs text-mono w-full"
         value={item.value}
         onSelect={(currentValue) => {
          value = currentValue;
          closeAndFocusTrigger(ids.trigger);
          onValueChange(value);
         }}
        >
         {#if value !== item.value && item.icon}
            <svelte:component this={item.icon} class="mr-2 h-4 w-4" />
         {:else}
         <Check
          class={cn(
           "mr-2 h-4 w-4",
           value !== item.value && "text-transparent"
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
         class="text-xs text-mono w-full"
         value={item.value}
         onSelect={(currentValue) => {
          value = currentValue;
          onValueChange(value);
          closeAndFocusTrigger(ids.trigger);
         }}
        >
         <Check
          class={cn(
           "mr-2 h-4 w-4",
           value !== item.value && "text-transparent"
          )}
         />
         {item.label}
        </Command.Item>
       {/each}
        </ScrollArea>
      </Command.Group>
     </Command.Root>
    </Popover.Content>
</Popover.Root>
</div>