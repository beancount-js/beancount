<script lang="ts">
  import FilterCommandPicker from "../../../components/forms/FilterCommandPicker.svelte";

  import {
    type FilterCommandOption,
    type FilterCommandSearchAction,
    type FormFieldRenderArgs,
  } from "@lapismd/design-core/forms";
  import { useIngestionApi, ingestionPath } from "../../ingestion/api";
  const { ingestionJson } = useIngestionApi();
  import type { SourceFormContext } from "../../ingestion/source-form-config";

  type Merchant = {
    merchantId: string;
    canonicalName: string;
    domain?: string;
    description?: string;
    aliases?: { normalizedValue: string }[];
    logoUrl?: string;
  };

  let {
    root,
    value,
    field,
    context,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, SourceFormContext, string> = $props();

  let merchants = $state<Merchant[]>([]);
  let loadError = $state("");
  let brandMatchBusy = $state(false);

  const projectId = $derived(context?.projectId ?? "");
  const source = $derived.by(() => {
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      return { id: "", name: "" };
    }
    const sourceRoot = root as { id?: unknown; name?: unknown };
    return {
      id: typeof sourceRoot.id === "string" ? sourceRoot.id : "",
      name: typeof sourceRoot.name === "string" ? sourceRoot.name : "",
    };
  });
  const options = $derived.by((): FilterCommandOption[] => {
    const listed = merchants.map((merchant) => ({
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
    }));
    const selected = listed.find((merchant) => merchant.value === value);
    return [
      {
        value: "",
        label: "No merchant selected",
        description:
          "Choose a saved merchant to use its logo for this connection.",
      },
      ...(selected || !value
        ? listed
        : [
            {
              value,
              label: value,
              description: "Saved merchant is unavailable in this project.",
            },
            ...listed,
          ]),
    ];
  });
  const selectedLabel = $derived(
    options.find((option) => option.value === value)?.label ?? value ?? "",
  );

  function domainFromUrl(value: string) {
    const input = value.trim();
    if (!input) return undefined;
    try {
      const url = new URL(
        /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`,
      );
      const domain = url.hostname.toLowerCase().replace(/^(?:www\.|api\.)/, "");
      return domain.includes(".") ? domain : undefined;
    } catch {
      return undefined;
    }
  }

  function brandMatchAction(search: string): FilterCommandSearchAction | null {
    const domain = domainFromUrl(search);
    if (
      !projectId ||
      !source.id ||
      !domain ||
      merchants.some((merchant) => merchant.domain?.toLowerCase() === domain)
    ) {
      return null;
    }
    return {
      label: `Fetch ${domain} with Brand Match`,
      description: "Create and save a merchant with its brand logo.",
    };
  }

  async function loadMerchants(nextProjectId: string) {
    try {
      const listed = await ingestionJson<Merchant[]>(
        ingestionPath(nextProjectId, "/merchants"),
      );
      if (nextProjectId !== projectId) return;
      merchants = Array.isArray(listed) ? listed : [];
      loadError = "";
    } catch (error) {
      if (nextProjectId !== projectId) return;
      merchants = [];
      loadError =
        error instanceof Error ? error.message : "Failed to load merchants";
    }
  }

  async function createMerchantFromBrandMatch(url: string) {
    if (brandMatchBusy || !projectId) return;
    brandMatchBusy = true;
    loadError = "";
    try {
      const merchant = await ingestionJson<Merchant>(
        ingestionPath(projectId, "/merchants/brand-match"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url,
            sourceId: source.id,
            sourceName: source.name,
          }),
        },
      );
      merchants = [
        merchant,
        ...merchants.filter((item) => item.merchantId !== merchant.merchantId),
      ].sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      );
      await update(merchant.merchantId);
    } catch (error) {
      loadError =
        error instanceof Error
          ? error.message
          : "Could not create a merchant from that URL.";
    } finally {
      brandMatchBusy = false;
    }
  }

  $effect(() => {
    if (!projectId) {
      merchants = [];
      loadError = "";
      return;
    }
    void loadMerchants(projectId);
  });
</script>

{#if readonly}
  <output>{selectedLabel || " "}</output>
{:else}
  <div class="merchant-combo-field" data-merchant-field={field.id}>
    <FilterCommandPicker
      fullWidth
      label="Merchant"
      ariaLabel={field.ariaLabel ?? field.label}
      placeholder="Search saved merchants..."
      emptyLabel={merchants.length
        ? "No matching merchants."
        : "No saved merchants yet."}
      stackedOptions
      value={value ?? ""}
      {options}
      searchAction={brandMatchAction}
      searchActionGroupLabel="Brand Match"
      onSearchAction={createMerchantFromBrandMatch}
      onChange={(next) => void update(next)}
    />
    {#if loadError}
      <p class="merchant-combo-field__error">{loadError}</p>
    {/if}
  </div>
{/if}

<style>
  .merchant-combo-field {
    width: 100%;
    min-width: 0;
  }

  .merchant-combo-field__error {
    margin: 0.375rem 0 0;
    color: var(--destructive);
    font-size: 0.75rem;
  }
</style>
