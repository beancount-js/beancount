<script lang="ts">
  import { ChipAutocomplete } from "@lapismd/design-core/forms";
  let {
    value = [],
    suggestions = [],
    label = "Tags",
    showLabel = true,
    placeholder = "Add tag...",
    id,
    embedded = false,
    uppercase = true,
    onChange = () => {},
  }: {
    value?: readonly string[];
    suggestions?: readonly string[];
    label?: string;
    showLabel?: boolean;
    placeholder?: string;
    id?: string;
    embedded?: boolean;
    uppercase?: boolean;
    onChange?: (tags: string[]) => void | Promise<void>;
  } = $props();
</script>

<ChipAutocomplete
  value={[...value]}
  suggestions={[...suggestions]}
  {label}
  {showLabel}
  {placeholder}
  {id}
  {embedded}
  {uppercase}
  {onChange}
/>
