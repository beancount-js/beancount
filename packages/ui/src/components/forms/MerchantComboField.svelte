<script lang="ts">
  import MerchantPicker from "./MerchantPicker.svelte";
  import type { MerchantPickerMerchant } from "./MerchantPicker.svelte";
  import type { FormFieldRenderArgs } from "./types";

  type MerchantComboContext = {
    accounts: string[];
    merchants?: readonly MerchantPickerMerchant[];
  };

  let {
    value,
    field,
    context,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, MerchantComboContext, string> = $props();

  const merchants = $derived(context?.merchants ?? []);
</script>

<div data-merchant-field={field.id}>
  <MerchantPicker
    {merchants}
    value={value ?? ""}
    readOnly={readonly}
    label={field.label}
    ariaLabel={field.ariaLabel ?? field.label}
    placeholder="Search saved merchants..."
    onChange={(next) => void update(next)}
  />
</div>
