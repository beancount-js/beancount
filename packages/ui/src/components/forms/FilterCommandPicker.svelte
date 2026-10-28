<script lang="ts">
  import { FilterCommandPicker } from "@lapismd/design-core/forms";
  import type { ComponentProps } from "svelte";
  let props: ComponentProps<typeof FilterCommandPicker> = $props();
  const visibleLabel = $derived.by(() => {
    if (props.multiple) {
      const selected = (props.values ?? []).filter(
        (value) => value !== "all" && value !== "",
      );
      if (!selected.length) return props.label;
      if (selected.length > 1) return `${props.label} (${selected.length})`;
      return (
        props.options.find((option) => option.value === selected[0])?.label ??
        selected[0]!
      );
    }
    return (
      props.options.find((option) => option.value === props.value)?.label ??
      (props.value?.trim() || props.label)
    );
  });
</script>

<FilterCommandPicker
  {...props}
  ariaLabel={`${props.ariaLabel ?? props.label}: ${visibleLabel}`}
/>
