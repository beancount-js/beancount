<script lang="ts">
  import { CalendarIcon } from "lucide-svelte";
  import {
    type DateValue,
    getLocalTimeZone,
    today,
  } from "@internationalized/date";
  import { cn } from "$lib/utils.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Calendar } from "$lib/components/ui/calendar/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Select from "$lib/components/ui/select/index.js";

  export let value: DateValue | undefined = undefined;
  export let onValueChange: (date: DateValue | undefined) => void;

  const items = [
    {
      value: 0,
      label: "Today",
    },
    {
      value: 1,
      label: "Tomorrow",
    },
    {
      value: 3,
      label: "In 3 days",
    },
    {
      value: 7,
      label: "In a week",
    },
  ];
</script>

<span class="cm-inactive-hide z-50">
  <Popover.Root openFocus>
    <Popover.Trigger asChild let:builder>
      <Button
        variant="outline"
        class={cn(
          "clickable-icon view-action inline-block size-[20px] p-[3px] pt-0",
        )}
        builders={[builder]}
      >
        <CalendarIcon class="size-4" />
      </Button>
    </Popover.Trigger>
    <Popover.Content
      class="border-divider z-[1000] flex w-auto flex-col space-y-2 border border-solid p-2 font-sans text-xs"
    >
      <Select.Root
        {items}
        onSelectedChange={(v) => {
          if (!v) return;
          value = today(getLocalTimeZone()).add({ days: v.value });
        }}
      >
        <Select.Trigger>
          <Select.Value placeholder="Select" />
        </Select.Trigger>
        <Select.Content>
          {#each items as item}
            <Select.Item value={item.value}>{item.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <div class="rounded-md border">
        <Calendar bind:value {onValueChange} />
      </div>
    </Popover.Content>
  </Popover.Root>
</span>
