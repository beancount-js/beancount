<script lang="ts">
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
  let loadError = $state("");
  let lastAutoAttachedId = $state<string | null>(null);

  const normalizedDomain = $derived(domain.trim().toLowerCase());
  const rankTokens = $derived(
    searchText
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

  const rankedMerchants = $derived.by(() => {
    const scored = merchants.map((merchant) => {
      let score = 0;
      const merchantDomain = merchant.domain?.toLowerCase() ?? "";
      if (normalizedDomain && merchantDomain === normalizedDomain) {
        score += 100;
      } else if (
        normalizedDomain &&
        merchantDomain.includes(normalizedDomain)
      ) {
        score += 40;
      }
      const haystack = [
        merchant.canonicalName,
        merchant.domain ?? "",
        ...(merchant.aliases?.map((alias) => alias.normalizedValue) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      for (const token of rankTokens) {
        if (haystack.includes(token)) score += 10;
      }
      return { merchant, score };
    });
    scored.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.merchant.canonicalName.localeCompare(
        right.merchant.canonicalName,
        undefined,
        { sensitivity: "base" },
      );
    });
    return scored.map((item) => item.merchant);
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

  async function fetchMerchants() {
    if (!projectId) {
      merchants = [];
      return;
    }
    try {
      // Load the full project merchant catalog; FilterCommandPicker filters
      // client-side, and domain/name only affect ranking + auto-select.
      const listed = await ingestionJson<Merchant[]>(
        ingestionPath(projectId, "/merchants"),
      );
      merchants = Array.isArray(listed) ? listed : [];
      loadError = "";
    } catch (error) {
      merchants = [];
      loadError =
        error instanceof Error ? error.message : "Failed to load merchants";
    }
  }

  $effect(() => {
    // Refresh whenever the sheet context changes so newly confirmed
    // merchants appear without requiring a full page reload.
    if (!projectId) {
      merchants = [];
      return;
    }
    void projectId;
    void searchText;
    void domain;
    const timer = window.setTimeout(() => {
      void fetchMerchants();
    }, 150);
    return () => window.clearTimeout(timer);
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
  {controlId}
  messages={loadError ? [loadError] : []}
>
  <FilterCommandPicker
    fullWidth
    label="Existing merchant"
    ariaLabel="Select existing merchant"
    placeholder="Search merchants..."
    emptyLabel={merchants.length
      ? "No matching merchants."
      : "No saved merchants yet."}
    value={attachedMerchantId}
    {options}
    onChange={handleChange}
  />
</FormField>
