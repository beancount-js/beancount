<script lang="ts">
  import CalendarIcon from "lucide-svelte/icons/calendar";
  import {
    DateFormatter,
    type DateValue,
    getLocalTimeZone,
    today,
  } from "@internationalized/date";
  import { cn } from "$lib/utils.js";
  import { buttonVariants } from "@beancount-js/ui/shadcn/button";
  import { Calendar } from "@beancount-js/ui/shadcn/calendar";
  import * as Popover from "@beancount-js/ui/shadcn/popover";
  import * as Select from "@beancount-js/ui/shadcn/select";

  let {
    value: initialValue,
    onValueChange,
  }: {
    value?: DateValue;
    ref?: HTMLElement;
    onValueChange: (date: DateValue | undefined) => void;
  } = $props();
  const df = new DateFormatter("en-US", {
    dateStyle: "long",
  });
  let value: DateValue | undefined = $state();
  $effect(() => {
    value = initialValue;
  });
  const valueString = $derived(
    value ? df.format(value.toDate(getLocalTimeZone())) : "",
  );
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

<Popover.Root>
  <Popover.Trigger
    class={cn(
      buttonVariants({
        variant: "ghost",
        size: "xs",
        class:
          "cn-beta-codemirror-src-codemirror-extensions-datepicker-datepickerwidget-59-1",
      }),
      !value && "text-muted-foreground",
    )}
  >
    <CalendarIcon />
  </Popover.Trigger>
  <Popover.Content
    class="cn-beta-codemirror-src-codemirror-extensions-datepicker-datepickerwidget-66-1"
  >
    <Select.Root
      type="single"
      value={valueString}
      onValueChange={(v: string) => {
        if (!v) return;
        value = today(getLocalTimeZone()).add({ days: Number.parseInt(v) });
        onValueChange(value);
      }}
    >
      <Select.Trigger>
        {valueString}
      </Select.Trigger>
      <Select.Content>
        {#each items as item}
          <Select.Item value={`${item.value}`}>{item.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <div
      class="cn-beta-codemirror-src-codemirror-extensions-datepicker-datepickerwidget-85-1"
    >
      <Calendar type="single" bind:value {onValueChange} />
    </div>
  </Popover.Content>
</Popover.Root>
