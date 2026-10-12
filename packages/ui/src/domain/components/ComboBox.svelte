<script lang="ts">
  import { FilterCommandPicker } from "@lapismd/design-core/forms";
  let {
    items,
    value = "",
    placeholder = "Select account",
    onValueChange = () => {},
  }: {
    items: readonly { value: string; label: string }[];
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
