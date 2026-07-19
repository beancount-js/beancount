<script lang="ts">
  import type { Icon as IconType } from "lucide-svelte";
  import type { Snippet } from "svelte";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import type { FilterCommandOption } from "./picker-options";

  export type ComboBoxOption = {
    label: string;
    value: string;
  };

  export type ComboBoxGroup = {
    group: string;
    items: Array<ComboBoxOption & { icon?: typeof IconType }>;
  };

  let {
    class: className = "",
    items: options,
    value: selected = "",
    groups = [],
    placeholder = "Select",
    onValueChange = () => {},
  }: {
    class?: string;
    /**
     * Retained for compatibility. FilterCommandPicker owns the trigger, so a
     * custom trigger is intentionally ignored.
     */
    trigger?: Snippet<
      [
        {
          props: Record<string, unknown>;
          value: string;
          open: boolean;
          hasSelection: boolean;
          placeholder: string;
        },
      ]
    >;
    items: readonly ComboBoxOption[] | (() => readonly ComboBoxOption[]);
    groups?: readonly ComboBoxGroup[];
    value: string;
    placeholder?: string;
    onValueChange?: (value: string) => void;
  } = $props();

  const pickerOptions = $derived.by((): FilterCommandOption[] => {
    const values: FilterCommandOption[] = [];
    const seen = new Set<string>();

    values.push({ value: "all", label: placeholder });
    seen.add("all");

    for (const group of groups) {
      for (const item of group.items) {
        if (seen.has(item.value)) continue;
        seen.add(item.value);
        values.push({
          value: item.value,
          label: item.label,
          keywords: [group.group],
        });
      }
    }

    const list = typeof options === "function" ? options() : options;
    for (const item of list) {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      values.push({ value: item.value, label: item.label });
    }

    if (selected && selected !== "all" && !seen.has(selected)) {
      values.push({ label: selected, value: selected });
    }

    return values;
  });
  const pickerValue = $derived(
    selected && selected !== "all" ? selected : "all",
  );
</script>

<div class={["bj-combo-box", className].filter(Boolean).join(" ")}>
  <FilterCommandPicker
    fullWidth
    label={placeholder}
    ariaLabel={placeholder}
    placeholder={`Filter ${placeholder.toLowerCase()}...`}
    value={pickerValue}
    options={pickerOptions}
    onChange={(value) => onValueChange(value === "all" ? "" : value)}
  />
</div>

<style>
  .bj-combo-box {
    width: 100%;
    min-width: 0;
  }
</style>
