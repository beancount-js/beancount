<script lang="ts">
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import type { FilterCommandOption } from "./picker-options";
  import type { FormFieldRenderArgs } from "./types";

  type AccountContext = {
    accounts?: readonly string[];
  };

  type AccountPickerProps = Partial<
    FormFieldRenderArgs<unknown, AccountContext, string>
  > & {
    /** Display-ready account names supplied by the application. */
    accounts?: readonly string[];
    value?: string;
    label?: string;
    ariaLabel?: string;
    placeholder?: string;
    readOnly?: boolean;
    readonly?: boolean;
    onChange?: (account: string) => void | Promise<void>;
  };

  const props: AccountPickerProps = $props();

  const accounts = $derived(props.accounts ?? props.context?.accounts ?? []);
  const value = $derived(props.value ?? "");
  const label = $derived(props.label ?? props.field?.label ?? "Account");
  const placeholder = $derived(
    props.placeholder ?? props.field?.placeholder ?? "Select account",
  );
  const ariaLabel = $derived(props.ariaLabel ?? props.field?.ariaLabel ?? label);
  const readOnly = $derived(props.readOnly ?? props.readonly ?? false);

  const options = $derived.by((): FilterCommandOption[] => {
    const values: FilterCommandOption[] = [
      { value: "", label: placeholder },
      ...accounts.map((account) => ({ label: account, value: account })),
    ];

    if (value && !accounts.includes(value)) {
      values.push({
        value,
        label: value,
        description: "Saved account is unavailable in this configuration.",
      });
    }

    return values;
  });

  function change(account: string) {
    if (props.update) {
      void props.update(account);
      return;
    }
    void props.onChange?.(account);
  }
</script>

{#if readOnly}
  <output>{value || " "}</output>
{:else}
  <div class="bj-account-picker">
    <FilterCommandPicker
      fullWidth
      {value}
      {options}
      {label}
      {ariaLabel}
      placeholder={`Filter ${placeholder.toLowerCase()}...`}
      onChange={change}
    />
  </div>
{/if}

<style>
  .bj-account-picker {
    width: 100%;
    min-width: 0;
  }
</style>
