<script lang="ts">
  import {
    FilterCommandPicker,
    type FilterCommandOption,
  } from "@beancount-js/forms";
  import { SvelteSet } from "svelte/reactivity";
  import type { Snippet } from "svelte";
  import type { Icon as IconType } from "lucide-svelte";

  type ComboProps = {
    class?: string;
    /** @deprecated Custom triggers are ignored; FilterCommandPicker owns the trigger. */
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
    items:
      | Array<{ label: string; value: string }>
      | (() => Array<{ label: string; value: string }>);
    groups?: Array<{
      group: string;
      items: Array<{ label: string; value: string; icon?: typeof IconType }>;
    }>;
    value: string;
    placeholder?: string;
    onValueChange: (value: string) => void;
  };

  let {
    class: klass = "",
    items: options,
    value: selected = "",
    groups = [],
    placeholder = "Select",
    onValueChange = () => {},
  }: ComboProps = $props();

  const pickerOptions = $derived.by(() => {
    const values: FilterCommandOption[] = [];
    const seen = new SvelteSet<string>();

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

    const list = Array.isArray(options) ? options : options();
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

  const pickerValue = $derived(selected && selected !== "all" ? selected : "all");
</script>

<div class={["bj-combo-box", klass].filter(Boolean).join(" ")}>
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
