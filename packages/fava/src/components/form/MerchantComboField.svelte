<script lang="ts">
  import {
    FilterCommandPicker,
    type FilterCommandOption,
    type FormFieldRenderArgs,
  } from "@beancount-js/forms";
  import { ingestionJson, ingestionPath } from "../../ingestion/api";
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
    value,
    field,
    context,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, SourceFormContext, string> = $props();

  let merchants = $state<Merchant[]>([]);
  let loadError = $state("");

  const projectId = $derived(context?.projectId ?? "");
  const options = $derived.by((): FilterCommandOption[] => {
    const listed = merchants.map((merchant) => ({
      value: merchant.merchantId,
      label: merchant.domain
        ? `${merchant.canonicalName} · ${merchant.domain}`
        : merchant.canonicalName,
      description: [merchant.description, merchant.domain]
        .filter(Boolean)
        .join(" · "),
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
      value={value ?? ""}
      {options}
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
