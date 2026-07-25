<script lang="ts">
  import CalendarIcon from "lucide-svelte/icons/calendar";
  import {
    DateFormatter,
    type DateValue,
    getLocalTimeZone,
    today,
  } from "@internationalized/date";
  import { Button } from "../shadcn/button";
  import * as Calendar from "../shadcn/calendar";
  import * as Popover from "../shadcn/popover";
  import * as Select from "../shadcn/select";

  export type DatePickerShortcut = {
    value: string;
    label: string;
    daysFromToday: number;
  };

  const defaultShortcuts: readonly DatePickerShortcut[] = [
    { value: "today", label: "Today", daysFromToday: 0 },
    { value: "tomorrow", label: "Tomorrow", daysFromToday: 1 },
    { value: "three-days", label: "In 3 days", daysFromToday: 3 },
    { value: "week", label: "In a week", daysFromToday: 7 },
  ];

  let {
    value = $bindable<DateValue | undefined>(undefined),
    ariaLabel = "Choose date",
    placeholder = "Choose date",
    locale = "en-GB",
    shortcuts = defaultShortcuts,
    disabled = false,
    onValueChange,
  }: {
    /** The selected calendar value. Bind it to keep the picker controlled. */
    value?: DateValue | undefined;
    /** Labels the trigger when its displayed date is not sufficient context. */
    ariaLabel?: string;
    /** Shown in the trigger before a date has been selected. */
    placeholder?: string;
    /** Locale used for the human-readable selected-date label. */
    locale?: string;
    /** Compact relative-date choices shown above the calendar. */
    shortcuts?: readonly DatePickerShortcut[];
    disabled?: boolean;
    onValueChange?: (value: DateValue | undefined) => void;
  } = $props();

  let shortcutValue = $state("");
  const formatter = $derived(
    new DateFormatter(locale, { dateStyle: "medium" }),
  );
  const displayValue = $derived(
    value ? formatter.format(value.toDate(getLocalTimeZone())) : placeholder,
  );

  function updateValue(next: DateValue | undefined): void {
    value = next;
    shortcutValue = "";
    onValueChange?.(next);
  }

  function applyShortcut(next: string | undefined): void {
    const shortcut = shortcuts.find((item) => item.value === next);
    if (!shortcut) return;
    updateValue(
      today(getLocalTimeZone()).add({ days: shortcut.daysFromToday }),
    );
  }
</script>

<Popover.Root>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="outline"
        class="cn-forms-datepicker-79-1"
        aria-label={ariaLabel}
        {disabled}
      >
        <CalendarIcon aria-hidden="true" />
        <span class:cn-forms-datepicker-84-1={!value}>{displayValue}</span>
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="cn-forms-datepicker-89-1" aria-label="Date options">
    {#if shortcuts.length}
      <Select.Root
        type="single"
        value={shortcutValue}
        onValueChange={applyShortcut}
      >
        <Select.Trigger aria-label="Choose a date shortcut">
          Quick date
        </Select.Trigger>
        <Select.Content aria-label="Date shortcuts">
          {#each shortcuts as shortcut (shortcut.value)}
            <Select.Item value={shortcut.value}>{shortcut.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    {/if}
    <div class="cn-forms-datepicker-108-1">
      <Calendar.Calendar
        type="single"
        {value}
        onValueChange={(next) => updateValue(next as DateValue | undefined)}
      />
    </div>
  </Popover.Content>
</Popover.Root>
