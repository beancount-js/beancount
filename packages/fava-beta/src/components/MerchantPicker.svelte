<script lang="ts">
  import {
    MerchantPicker as SharedMerchantPicker,
    type MerchantPickerEmptyOption,
    type MerchantPickerMerchant,
  } from "@beancount-js/ui/forms";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { rankLocalMerchantMatches } from "../lib/fuzzy-search";

  type Props = {
    projectId: string;
    value?: string;
    domain?: string;
    searchText?: string;
    sourceId?: string;
    sourceName?: string;
    account?: string;
    label?: string;
    ariaLabel?: string;
    placeholder?: string;
    emptyOption?: MerchantPickerEmptyOption;
    autoAttachExactDomain?: boolean;
    readOnly?: boolean;
    onChange?: (merchantId: string) => void | Promise<void>;
    onAttach?: (merchant: MerchantPickerMerchant) => void;
    onError?: (message: string) => void;
  };

  let {
    projectId,
    value = $bindable(""),
    domain = "",
    searchText = "",
    sourceId = "",
    sourceName = "",
    account = "",
    label = "Merchant",
    ariaLabel = label,
    placeholder = "Search merchants...",
    emptyOption,
    autoAttachExactDomain = false,
    readOnly = false,
    onChange,
    onAttach,
    onError,
  }: Props = $props();

  let merchants = $state<MerchantPickerMerchant[]>([]);
  let loadError = $state("");
  let brandMatchBusy = $state(false);
  let lastAutoAttachedId = $state<string | null>(null);

  const normalizedDomain = $derived(domain.trim().toLowerCase());
  const rankedMerchants = $derived.by(() =>
    rankLocalMerchantMatches(merchants, searchText, domain),
  );

  function merchantById(id: string) {
    return merchants.find((merchant) => merchant.merchantId === id);
  }

  function reportError(message: string) {
    loadError = message;
    onError?.(message);
  }

  function domainFromUrl(inputValue: string) {
    const input = inputValue.trim();
    if (!input) return undefined;
    try {
      const url = new URL(
        /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`,
      );
      const nextDomain = url.hostname
        .toLowerCase()
        .replace(/^(?:www\.|api\.)/, "");
      return nextDomain.includes(".") ? nextDomain : undefined;
    } catch {
      return undefined;
    }
  }

  function brandMatchAction(search: string) {
    const nextDomain = domainFromUrl(search);
    if (
      !projectId ||
      (!sourceId && !sourceName && !account) ||
      !nextDomain ||
      merchants.some((merchant) => merchant.domain?.toLowerCase() === nextDomain)
    ) {
      return null;
    }
    return {
      label: `Create ${nextDomain} with Brand Match`,
      description: "Save a merchant with its Brandfetch logo.",
    };
  }

  function attachMerchant(merchant: MerchantPickerMerchant) {
    value = merchant.merchantId;
    void onChange?.(merchant.merchantId);
    onAttach?.(merchant);
  }

  async function createMerchantFromBrandMatch(url: string) {
    const requestedProjectId = projectId;
    if (brandMatchBusy || !requestedProjectId || (!sourceId && !account))
      return;
    brandMatchBusy = true;
    reportError("");
    try {
      const merchant = await ingestionJson<MerchantPickerMerchant>(
        ingestionPath(requestedProjectId, "/merchants/brand-match"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url,
            ...(sourceId ? { sourceId, sourceName } : { account }),
          }),
        },
      );
      if (requestedProjectId !== projectId) return;
      merchants = [
        merchant,
        ...merchants.filter((item) => item.merchantId !== merchant.merchantId),
      ].sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      );
      lastAutoAttachedId = merchant.merchantId;
      attachMerchant(merchant);
    } catch (error) {
      reportError(
        error instanceof Error
          ? error.message
          : "Could not create a merchant from that URL.",
      );
    } finally {
      brandMatchBusy = false;
    }
  }

  async function fetchMerchants(nextProjectId: string) {
    try {
      const listed = await ingestionJson<MerchantPickerMerchant[]>(
        ingestionPath(nextProjectId, "/merchants"),
      );
      if (nextProjectId !== projectId) return;
      merchants = Array.isArray(listed) ? listed : [];
      reportError("");
    } catch (error) {
      if (nextProjectId !== projectId) return;
      merchants = [];
      reportError(
        error instanceof Error ? error.message : "Failed to load merchants",
      );
    }
  }

  function handleChange(nextValue: string) {
    if (!nextValue) {
      value = "";
      lastAutoAttachedId = null;
      void onChange?.("");
      return;
    }
    const merchant = merchantById(nextValue);
    if (!merchant) return;
    lastAutoAttachedId = null;
    attachMerchant(merchant);
  }

  $effect(() => {
    if (!projectId) {
      merchants = [];
      reportError("");
      return;
    }
    void fetchMerchants(projectId);
  });

  $effect(() => {
    if (!autoAttachExactDomain || !normalizedDomain || value) return;

    const exactMatches = merchants.filter(
      (merchant) => merchant.domain?.toLowerCase() === normalizedDomain,
    );
    if (exactMatches.length !== 1) return;

    const match = exactMatches[0]!;
    if (lastAutoAttachedId === match.merchantId) return;

    lastAutoAttachedId = match.merchantId;
    attachMerchant(match);
  });
</script>

<div class="merchant-picker">
  <SharedMerchantPicker
    merchants={rankedMerchants}
    {value}
    {label}
    {ariaLabel}
    {placeholder}
    {emptyOption}
    {readOnly}
    searchAction={brandMatchAction}
    searchActionGroupLabel="Brand Match"
    onSearchAction={createMerchantFromBrandMatch}
    onChange={handleChange}
    {onAttach}
  />
  {#if !readOnly && loadError}
    <p class="merchant-picker__error">{loadError}</p>
  {/if}
</div>

<style>
  .merchant-picker {
    width: 100%;
    min-width: 0;
  }

  .merchant-picker__error {
    margin: 0.375rem 0 0;
    color: var(--destructive);
    font-size: 0.75rem;
  }
</style>
