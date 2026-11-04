<script lang="ts">
  import FilterCommandPicker from "../../components/forms/FilterCommandPicker.svelte";
  import type { FilterCommandOption } from "@lapismd/design-core/forms";

  let {
    items,
    value = "",
    placeholder = "Select account",
    onValueChange = () => {},
  }: {
    items: readonly FilterCommandOption[];
    value?: string;
    placeholder?: string;
    onValueChange?: (value: string) => void;
  } = $props();
</script>

<FilterCommandPicker
  fullWidth
  label={placeholder}
  ariaLabel={placeholder}
  {value}
  options={[...items]}
  allowCustom
  onChange={onValueChange}
/>
