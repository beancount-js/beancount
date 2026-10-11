<script lang="ts">
  import { DatePicker } from "@lapismd/design-core/forms";
  import { parseDate, type DateValue } from "@internationalized/date";
  let {
    value,
    onValueChange,
  }: {
    value?: DateValue;
    ref?: HTMLElement;
    onValueChange: (date: DateValue | undefined) => void;
  } = $props();
</script>

<DatePicker
  value={value?.toString()}
  ariaLabel="Directive date"
  onValueChange={(next) => onValueChange(next ? parseDate(next) : undefined)}
/>
