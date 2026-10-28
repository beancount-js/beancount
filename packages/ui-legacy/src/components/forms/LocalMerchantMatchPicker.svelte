<script lang="ts">
  import FormField from "./FormField.svelte";
  import MerchantPicker, {
    type MerchantPickerEmptyOption,
    type MerchantPickerMerchant,
  } from "./MerchantPicker.svelte";
  import type { FilterCommandSearchAction } from "./picker-options";

  let {
    merchants,
    value = $bindable(""),
    domain = "",
    label = "Existing merchant",
    ariaLabel = label,
    placeholder = "Search merchants...",
    emptyOption,
    autoAttachExactDomain = true,
    readOnly = false,
    onChange = () => {},
    onAttach,
    searchAction,
    searchActionGroupLabel = "Actions",
    onSearchAction,
    messages = [],
  }: {
    /** Merchants provided by the consuming application. */
    merchants: readonly MerchantPickerMerchant[];
    /** Controlled value. */
    value?: string;
    /** Domain used for auto-attach exact domain matching. */
    domain?: string;
    label?: string;
    ariaLabel?: string;
    placeholder?: string;
    emptyOption?: MerchantPickerEmptyOption;
    /** Keep auto-attach when exactly one exact-domain merchant matches. */
    autoAttachExactDomain?: boolean;
    readOnly?: boolean;
    onChange?: (merchantId: string) => void | Promise<void>;
    onAttach?: (merchant: MerchantPickerMerchant) => void;
    searchAction?: (
      search: string,
    ) => FilterCommandSearchAction | null | undefined;
    searchActionGroupLabel?: string;
    onSearchAction?: (search: string) => void | Promise<void>;
    /** Optional FormField messages from application-owned adapter logic. */
    messages?: string[];
  } = $props();

  const controlId = $props.id();
  const normalizedDomain = $derived(domain.trim().toLowerCase());
  let lastAutoAttachedId = $state<string | null>(null);

  function reportSelection(nextValue: string) {
    value = nextValue;
    void onChange(nextValue);
  }

  function handleAttach(merchant: MerchantPickerMerchant) {
    lastAutoAttachedId = merchant.merchantId;
    onAttach?.(merchant);
  }

  $effect(() => {
    if (!autoAttachExactDomain || !normalizedDomain || value) return;

    const exactMatches = merchants.filter(
      (merchant) => merchant.domain?.toLowerCase() === normalizedDomain,
    );
    if (exactMatches.length !== 1) return;

    const match = exactMatches[0];
    if (!match || match.merchantId === lastAutoAttachedId) return;

    reportSelection(match.merchantId);
    handleAttach(match);
  });
</script>

<FormField
  {label}
  as="div"
  align="center"
  {controlId}
  messages={messages ?? []}
>
  <MerchantPicker
    {merchants}
    {value}
    {label}
    {ariaLabel}
    {placeholder}
    {emptyOption}
    {readOnly}
    {searchAction}
    {searchActionGroupLabel}
    {onSearchAction}
    onChange={reportSelection}
    onAttach={handleAttach}
  />
</FormField>
