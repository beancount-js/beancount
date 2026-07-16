<script lang="ts">
  import {
    FilterCommandPicker,
    type FormFieldRenderArgs,
  } from "@beancount-js/forms";

  type AccountContext = {
    accounts?: string[];
  };

  let {
    value,
    field,
    context,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, AccountContext, string> = $props();

  const placeholder = $derived(field.placeholder ?? "Select account");
  const options = $derived.by(() => {
    const accounts = (context?.accounts ?? []).map((account: string) => ({
      label: account,
      value: account,
    }));
    const values = [
      { value: "all", label: placeholder },
      ...accounts,
    ];
    if (value && value !== "all" && !accounts.some((item) => item.value === value)) {
      values.push({ label: value, value });
    }
    return values;
  });
  const pickerValue = $derived(value && value !== "all" ? value : "all");
</script>

{#if readonly}
  <output>{value || " "}</output>
{:else}
  <div data-account-field={field.id} class="account-combo-field">
    <FilterCommandPicker
      fullWidth
      label={placeholder}
      ariaLabel={placeholder}
      placeholder={`Filter ${placeholder.toLowerCase()}...`}
      value={pickerValue}
      {options}
      onChange={(next) => void update(next === "all" ? "" : next)}
    />
  </div>
{/if}

<style>
  .account-combo-field {
    width: 100%;
    min-width: 0;
  }
</style>
