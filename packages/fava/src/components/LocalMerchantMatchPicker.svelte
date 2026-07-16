<script lang="ts">
  import { onMount } from "svelte";
  import {
    FilterCommandPicker,
    FormField,
    type FilterCommandOption,
  } from "@beancount-js/forms";
  import { ingestionJson, ingestionPath } from "../ingestion/api";

  type Merchant = {
    merchantId: string;
    canonicalName: string;
    domain?: string;
    description?: string;
    aliases?: { normalizedValue: string }[];
    logoUrl?: string;
  };

  type Props = {
    projectId: string;
    domain?: string;
    searchText?: string;
    attachedMerchantId?: string;
    onAttach?: (merchant: {
      merchantId: string;
      canonicalName: string;
      domain?: string;
      description?: string;
    }) => void;
  };

  let {
    projectId,
    domain = "",
    searchText = "",
    attachedMerchantId = $bindable(""),
    onAttach,
  }: Props = $props();

  const controlId = $props.id();

  let merchants = $state<Merchant[]>([]);
  let lastAutoAttachedId = $state<string | null>(null);

  const query = $derived((searchText || domain).trim());
  const normalizedDomain = $derived(domain.trim().toLowerCase());

  const rankedMerchants = $derived.by(() => {
    const exact: Merchant[] = [];
    const rest: Merchant[] = [];
    for (const merchant of merchants) {
      if (
        normalizedDomain &&
        merchant.domain?.toLowerCase() === normalizedDomain
      ) {
        exact.push(merchant);
      } else {
        rest.push(merchant);
      }
    }
    return [...exact, ...rest];
  });

  const options = $derived.by((): FilterCommandOption[] => {
    const items: FilterCommandOption[] = [
      { value: "", label: "Create new merchant" },
    ];
    for (const merchant of rankedMerchants) {
      const name = merchant.canonicalName;
      const merchantDomain = merchant.domain;
      items.push({
        value: merchant.merchantId,
        label: merchantDomain ? `${name} · ${merchantDomain}` : name,
        keywords: [
          name,
          ...(merchantDomain ? [merchantDomain] : []),
          ...(merchant.aliases?.map((alias) => alias.normalizedValue) ?? []),
        ],
      });
    }
    return items;
  });

  function merchantById(id: string) {
    return merchants.find((merchant) => merchant.merchantId === id);
  }

  function attachMerchant(merchant: Merchant) {
    attachedMerchantId = merchant.merchantId;
    onAttach?.({
      merchantId: merchant.merchantId,
      canonicalName: merchant.canonicalName,
      domain: merchant.domain,
      description: merchant.description,
    });
  }

  async function fetchMerchants(q: string) {
    try {
      merchants = await ingestionJson<Merchant[]>(
        ingestionPath(projectId, `/merchants?query=${encodeURIComponent(q)}`),
      );
    } catch {
      merchants = [];
    }
  }

  $effect(() => {
    const q = query;
    const timer = window.setTimeout(() => {
      void fetchMerchants(q);
    }, 250);

    return () => window.clearTimeout(timer);
  });

  onMount(() => {
    void fetchMerchants(query);
  });

  $effect(() => {
    if (!normalizedDomain || attachedMerchantId) return;

    const exactMatches = merchants.filter(
      (merchant) => merchant.domain?.toLowerCase() === normalizedDomain,
    );
    if (exactMatches.length !== 1) return;

    const match = exactMatches[0]!;
    if (lastAutoAttachedId === match.merchantId) return;

    lastAutoAttachedId = match.merchantId;
    attachMerchant(match);
  });

  function handleChange(value: string) {
    if (!value) {
      attachedMerchantId = "";
      lastAutoAttachedId = null;
      return;
    }
    const merchant = merchantById(value);
    if (!merchant) return;
    lastAutoAttachedId = null;
    attachMerchant(merchant);
  }
</script>

<FormField
  label="Existing merchant"
  as="div"
  align="center"
  controlId={controlId}
>
  <FilterCommandPicker
    fullWidth
    label="Existing merchant"
    ariaLabel="Select existing merchant"
    placeholder="Search merchants..."
    value={attachedMerchantId}
    {options}
    onChange={handleChange}
  />
</FormField>
