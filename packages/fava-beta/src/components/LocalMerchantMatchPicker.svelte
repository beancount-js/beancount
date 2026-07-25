<script lang="ts">
  import {
    LocalMerchantMatchPicker as SharedLocalMerchantMatchPicker,
    type FilterCommandSearchAction,
    type MerchantPickerEmptyOption,
    type MerchantPickerMerchant,
  } from "@lapis/ui/forms";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { rankLocalMerchantMatches } from "../lib/fuzzy-search";

  type MerchantAttachPayload = {
    merchantId: string;
    canonicalName: string;
    domain?: string;
    description?: string;
  };

  type Props = {
    projectId: string;
    domain?: string;
    searchText?: string;
    sourceId?: string;
    sourceName?: string;
    attachedMerchantId?: string;
    onAttach?: (merchant: MerchantAttachPayload) => void;
  };

  let {
    projectId,
    domain = "",
    searchText = "",
    sourceId = "manual-review",
    sourceName = "",
    attachedMerchantId = $bindable(""),
    onAttach,
  }: Props = $props();

  const emptyOption: MerchantPickerEmptyOption = {
    label: "Create new merchant",
    description: "Save the merchant details from this transaction.",
  };

  let merchants = $state<MerchantPickerMerchant[]>([]);
  let loadError = $state("");
  let brandMatchBusy = $state(false);

  const rankedMerchants = $derived.by(() =>
    rankLocalMerchantMatches(merchants, searchText, domain),
  );

  const messages = $derived.by((): string[] => (loadError ? [loadError] : []));

  function reportError(message: string) {
    loadError = message;
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
      (!sourceId && !sourceName) ||
      !nextDomain ||
      merchants.some((merchant) => merchant.domain?.toLowerCase() === nextDomain)
    ) {
      return null;
    }
    return {
      label: `Create ${nextDomain} with Brand Match`,
      description: "Save a merchant with its Brandfetch logo.",
    } satisfies FilterCommandSearchAction;
  }

  async function createMerchantFromBrandMatch(url: string) {
    if (brandMatchBusy || !projectId || (!sourceId && !sourceName)) return;
    brandMatchBusy = true;
    reportError("");
    try {
      const merchant = await ingestionJson<MerchantPickerMerchant>(
        ingestionPath(projectId, "/merchants/brand-match"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url,
            ...(sourceId ? { sourceId, sourceName } : {}),
          }),
        },
      );
      merchants = [
        merchant,
        ...merchants.filter((item) => item.merchantId !== merchant.merchantId),
      ].sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      );
      attachedMerchantId = merchant.merchantId;
      onAttach?.(merchant);
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

  $effect(() => {
    if (!projectId) {
      merchants = [];
      reportError("");
      return;
    }
    void fetchMerchants(projectId);
  });
</script>

<SharedLocalMerchantMatchPicker
  merchants={rankedMerchants}
  {emptyOption}
  {domain}
  bind:value={attachedMerchantId}
  label="Existing merchant"
  ariaLabel="Select existing merchant"
  messages={messages}
  autoAttachExactDomain
  searchAction={brandMatchAction}
  searchActionGroupLabel="Brand Match"
  onSearchAction={createMerchantFromBrandMatch}
  onAttach={onAttach}
/>
