<script lang="ts">
  import { FilterCommandPicker } from "@lapismd/design-core/forms";
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
  const options = $derived(Array.isArray(items) ? items : items());
</script>

<span class={klass}
  ><FilterCommandPicker
    label="Account"
    ariaLabel="Account"
    {options}
    {value}
    allowCustom
    onChange={onValueChange}
  /></span
>
