<script lang="ts">
  import {
    FilterCommandPicker,
    type FilterCommandOption,
    type FilterCommandSearchAction,
  } from "@beancount-js/forms";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { rankLocalMerchantMatches } from "../lib/fuzzy-search";

  type Merchant = {
    merchantId: string;
    canonicalName: string;
    domain?: string;
    description?: string;
    aliases?: { normalizedValue: string }[];
    logoUrl?: string;
  };

  type EmptyOption = {
    label: string;
    description: string;
  };

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
    emptyOption?: EmptyOption;
    autoAttachExactDomain?: boolean;
    readOnly?: boolean;
    onChange?: (merchantId: string) => void | Promise<void>;
    onAttach?: (merchant: Merchant) => void;
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

  let merchants = $state<Merchant[]>([]);
  let loadError = $state("");
  let brandMatchBusy = $state(false);
  let lastAutoAttachedId = $state<string | null>(null);

  const normalizedDomain = $derived(domain.trim().toLowerCase());
  const rankedMerchants = $derived(
    rankLocalMerchantMatches(merchants, searchText, domain),
  );
  const options = $derived.by((): FilterCommandOption[] => {
    const selectedMerchant = merchants.find(
      (merchant) => merchant.merchantId === value,
    );
    const visibleMerchants = selectedMerchant
      ? [
          selectedMerchant,
          ...rankedMerchants.filter(
            (merchant) => merchant.merchantId !== selectedMerchant.merchantId,
          ),
        ]
      : rankedMerchants;
    const items: FilterCommandOption[] = emptyOption
      ? [
          {
            value: "",
            label: emptyOption.label,
            description: emptyOption.description,
          },
        ]
      : [];

    if (value && !selectedMerchant) {
      items.push({
        value,
        label: value,
        description: "Saved merchant is unavailable in this project.",
      });
    }

    for (const merchant of visibleMerchants) {
      items.push({
        value: merchant.merchantId,
        label: merchant.canonicalName,
        description: [merchant.domain, merchant.description]
          .filter(Boolean)
          .join("\n"),
        imageUrl: merchant.logoUrl,
        keywords: [
          merchant.canonicalName,
          ...(merchant.domain ? [merchant.domain] : []),
          ...(merchant.description ? [merchant.description] : []),
          ...(merchant.aliases?.map((alias) => alias.normalizedValue) ?? []),
        ],
      });
    }
    return items;
  });

  function merchantById(id: string) {
    return merchants.find((merchant) => merchant.merchantId === id);
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

  function brandMatchAction(search: string): FilterCommandSearchAction | null {
    const nextDomain = domainFromUrl(search);
    if (
      !projectId ||
      (!sourceId && !account) ||
      !nextDomain ||
      merchants.some(
        (merchant) => merchant.domain?.toLowerCase() === nextDomain,
      )
    ) {
      return null;
    }
    return {
      label: `Create ${nextDomain} with Brand Match`,
      description: "Save a merchant with its Brandfetch logo.",
    };
  }

  function reportError(message: string) {
    loadError = message;
    onError?.(message);
  }

  function attachMerchant(merchant: Merchant) {
    value = merchant.merchantId;
    void onChange?.(merchant.merchantId);
    onAttach?.(merchant);
  }

  async function fetchMerchants(nextProjectId: string) {
    try {
      const listed = await ingestionJson<Merchant[]>(
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

  async function createMerchantFromBrandMatch(url: string) {
    const requestedProjectId = projectId;
    if (brandMatchBusy || !requestedProjectId || (!sourceId && !account))
      return;
    brandMatchBusy = true;
    reportError("");
    try {
      const merchant = await ingestionJson<Merchant>(
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
</script>

<div class="merchant-picker">
  {#if readOnly}
    <output
      >{(options.find((option) => option.value === value)?.label ?? value) ||
        " "}</output
    >
  {:else}
    <FilterCommandPicker
      fullWidth
      {label}
      {ariaLabel}
      {placeholder}
      emptyLabel={merchants.length
        ? "No matching merchants."
        : "No saved merchants yet."}
      stackedOptions
      {value}
      {options}
      searchAction={brandMatchAction}
      searchActionGroupLabel="Brand Match"
      onSearchAction={createMerchantFromBrandMatch}
      onChange={handleChange}
    />
  {/if}
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
