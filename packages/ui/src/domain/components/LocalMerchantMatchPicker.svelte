<script lang="ts">
  import {
    FilterCommandPicker,
    FormField,
    type FilterCommandOption,
  } from "@lapismd/design-core/forms";
  import { useIngestionApi, ingestionPath } from "../ingestion/api";
  const { ingestionJson } = useIngestionApi();
  import { rankLocalMerchantMatches } from "../lib/fuzzy-search";

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

  let merchants = $state<Merchant[]>([]);
  let loadError = $state("");
  let lastAutoAttachedId = $state<string | null>(null);

  const normalizedDomain = $derived(domain.trim().toLowerCase());

  const rankedMerchants = $derived(
    rankLocalMerchantMatches(merchants, searchText, domain),
  );

  const options = $derived.by((): FilterCommandOption[] => {
    const items: FilterCommandOption[] = [
      {
        value: "",
        label: "Create new merchant",
        description: "Save the merchant details from this transaction.",
      },
    ];
    for (const merchant of rankedMerchants) {
      const name = merchant.canonicalName;
      const merchantDomain = merchant.domain;
      items.push({
        value: merchant.merchantId,
        label: merchantDomain ? `${name} · ${merchantDomain}` : name,
        description: [merchant.description, merchantDomain]
          .filter(Boolean)
          .join(" · "),
        imageUrl: merchant.logoUrl,
        keywords: [
          name,
          ...(merchant.description ? [merchant.description] : []),
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

<FormField label="Existing merchant" as="div" align="center" error={loadError}>
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
