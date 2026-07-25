<script lang="ts">
  import Check from "lucide-svelte/icons/check";
  import Edit from "lucide-svelte/icons/edit";
  import { tick } from "svelte";
  import * as Command from "@beancount-js/ui/shadcn/command";
  import * as Popover from "@beancount-js/ui/shadcn/popover";
  import { Button } from "@beancount-js/ui/shadcn/button";
  import { cn } from "$lib/utils.js";
  import { ScrollArea } from "@beancount-js/ui/shadcn/scroll-area";

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
            class="cn-beta-codemirror-src-codemirror-extensions-combobox-combowidget-51-1 cm-account-combo__trigger"
            {...props}
            role="combobox"
            aria-expanded={open}
            aria-label={`Change account ${value}`}
            title="Change account"
          >
            <Edit
              class="cn-beta-codemirror-src-codemirror-extensions-combobox-combowidget-58-1"
            />
            <span class="sr-only">{value}</span>
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content
        class="cn-beta-codemirror-src-codemirror-extensions-combobox-combowidget-63-1"
        align="start"
        sideOffset={4}
      >
        <Command.Root>
          <Command.Input placeholder="Search accounts..." />
          <Command.List>
            <Command.Empty>No accounts found.</Command.Empty>
            <Command.Group>
              <ScrollArea
                class="cn-beta-codemirror-src-codemirror-extensions-combobox-combowidget-69-1"
              >
                {#each options as item (item.value)}
                  <Command.Item
                    value={item.value}
                    class="cn-beta-codemirror-src-codemirror-extensions-combobox-combowidget-73-1"
                    onSelect={() => selectItem(item.value)}
                  >
                    <Check
                      class={cn(
                        "cn-beta-codemirror-src-codemirror-extensions-combobox-combowidget-78-1",
                        value !== item.value &&
                          "cn-beta-codemirror-src-codemirror-extensions-combobox-combowidget-79-1",
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
  /*
    Keep a real inline box so CodeMirror's coordinate scan can measure the
    widget. Negative end margin pulls following text back so the icon does
    not force an extra wrap.
  */
  :global(.cm-account-combo-host) {
    display: inline-flex;
    align-items: center;
    width: 1rem;
    margin-left: 0.1rem;
    margin-right: -1.1rem;
    vertical-align: text-bottom;
  }

  :global(.cm-account-combo) {
    display: inline-flex;
    width: auto;
  }

  :global(.cm-account-combo__trigger) {
    min-width: 1rem;
    width: 1rem;
    height: 1rem;
    padding: 0;
  }
</style>
