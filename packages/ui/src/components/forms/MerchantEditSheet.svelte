<script lang="ts">
  import { type FormConfig, type FormValidationIssue } from "./types";
  import FormField from "./FormField.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import StructuredForm from "./StructuredForm.svelte";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import X from "lucide-svelte/icons/x";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";
  import * as Sheet from "../shadcn/sheet";
  import * as Tooltip from "../shadcn/tooltip";

  type MerchantAlias = {
    value: string;
    normalizedValue: string;
    sourceId: string;
  };

  type MerchantProvenance = {
    source: string;
    provider?: string | null;
    model?: string | null;
    version?: string | null;
    observedAt: string;
  };

  type MerchantBrandAsset = {
    filename: string;
    size?: string | number;
    mediaType: string;
  };

  type MerchantBrand = {
    provider: string;
    brandId?: string | null;
    fetchedAt: string;
    expiresAt: string;
    asset?: MerchantBrandAsset;
  };

  export type MerchantEditProfile = {
    merchantId?: string;
    canonicalName: string;
    domain: string;
    description: string;
    industry: string;
    countryCode: string;
    notes: string;
    aliases: readonly MerchantAlias[];
    provenance: readonly MerchantProvenance[];
    brand?: MerchantBrand | null;
    logoUrl?: string;
    logoDelivery?: "local-cache" | "server-proxy";
  };

  type Props = {
    open?: boolean;
    merchant?: MerchantEditProfile | undefined;
    loading?: boolean;
    loadError?: string;
    refreshingLogo?: boolean;
    status?: string;
    detailsForm: FormConfig<MerchantEditProfile>;
    issues?: FormValidationIssue[];
    onChange?: (next: unknown) => void;
    onRefreshLogo?: () => void;
    onClosed?: () => void;
    onOpenChange?: (next: boolean) => void;
  };

  let {
    open = $bindable(false),
    merchant = $bindable<MerchantEditProfile | undefined>(undefined),
    loading = false,
    loadError = "",
    refreshingLogo = false,
    status = "",
    detailsForm,
    issues = [],
    onChange,
    onRefreshLogo,
    onClosed,
    onOpenChange,
  }: Props = $props();

  const sectionTitleClass =
    "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  let failedLogo = $state(false);
  let sheetTitleEl = $state<HTMLElement | null>(null);
  let openSections = $state<Record<string, boolean>>({
    details: true,
    aliases: true,
    provenance: true,
    brand: true,
  });

  const sectionsCollapsedAll = $derived(
    Object.values(openSections).every((sectionOpen) => sectionOpen === false),
  );

  const headerTitle = $derived(
    merchant?.canonicalName.trim() || (loading ? "Loading…" : "Merchant"),
  );

  const merchantInitial = $derived(
    (merchant?.canonicalName.trim().slice(0, 1) || "?").toUpperCase(),
  );

  function formatTwoDigits(value: number) {
    return `${value}`.padStart(2, "0");
  }

  function formatTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${formatTwoDigits(
      date.getMonth() + 1,
    )}-${formatTwoDigits(date.getDate())} ${formatTwoDigits(
      date.getHours(),
    )}:${formatTwoDigits(date.getMinutes())}`;
  }

  function provenanceSecondary(entry: MerchantProvenance): string {
    const meta = [entry.provider, entry.model, entry.version]
      .filter(Boolean)
      .join(" · ");
    const observed = formatTimestamp(entry.observedAt);
    return meta ? `${meta} · ${observed}` : observed;
  }

  function isSectionOpen(id: string) {
    return openSections[id] !== false;
  }

  function toggleSection(id: string) {
    openSections = { ...openSections, [id]: !isSectionOpen(id) };
  }

  function toggleCollapseAll() {
    const next = !sectionsCollapsedAll;
    openSections = Object.fromEntries(
      Object.keys(openSections).map((key) => [key, !next]),
    );
  }

  function handleOpenChange(next: boolean) {
    open = next;
    onOpenChange?.(next);
    if (!next) {
      onClosed?.();
    }
  }

  function handleChange(next: MerchantEditProfile) {
    onChange?.(next);
  }

  function handleLogoError() {
    failedLogo = true;
  }

  $effect(() => {
    if (merchant?.canonicalName) {
      failedLogo = false;
    } else {
      failedLogo = false;
    }
  });
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
  <Sheet.Content
    side="right"
    class="cn-forms-merchanteditsheet-178-1"
    data-merchant-edit-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header class="cn-forms-merchanteditsheet-186-1">
      <div class="cn-forms-merchanteditsheet-188-1">
        {#if merchant?.logoUrl && !failedLogo}
          <img
            class="cn-forms-merchanteditsheet-191-1"
            src={merchant.logoUrl}
            alt=""
            onerror={handleLogoError}
          />
        {:else if merchant}
          <div class="cn-forms-merchanteditsheet-198-1" aria-hidden="true">
            {merchantInitial}
          </div>
        {/if}
        <Sheet.Title
          bind:ref={sheetTitleEl}
          tabindex={-1}
          class="cn-forms-merchanteditsheet-207-1 merchant-edit-sheet-title"
        >
          {headerTitle}
        </Sheet.Title>
      </div>
      <Sheet.Description class="sr-only">
        Edit saved merchant profile {headerTitle}.
      </Sheet.Description>
      <div class="cn-forms-merchanteditsheet-215-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                class="cn-forms-merchanteditsheet-224-1"
                aria-label={sectionsCollapsedAll
                  ? "Expand all"
                  : "Collapse all"}
                onclick={(event) => {
                  toggleCollapseAll();
                }}
              >
                {#if sectionsCollapsedAll}
                  <ChevronsUpDown
                    class="cn-forms-merchanteditsheet-233-1"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronsDownUp
                    class="cn-forms-merchanteditsheet-235-1"
                    aria-hidden="true"
                  />
                {/if}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {sectionsCollapsedAll ? "Expand all" : "Collapse all"}
          </Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Sheet.Close
                {...props}
                class="cn-forms-merchanteditsheet-249-1"
                aria-label="Close"
              >
                <X class="cn-forms-merchanteditsheet-252-1" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Sheet.Header>

    <div class="cn-forms-merchanteditsheet-262-1">
      {#if loadError && !merchant}
        <Alert.Root
          variant="destructive"
          class="cn-forms-merchanteditsheet-264-1"
        >
          <CircleAlert />
          <Alert.Title>Could not load merchant</Alert.Title>
          <Alert.Description class="cn-forms-merchanteditsheet-267-1"
            >{loadError}</Alert.Description
          >
        </Alert.Root>
      {/if}

      {#if loading && !merchant}
        <p class="cn-forms-merchanteditsheet-274-1">Loading merchant…</p>
      {:else if merchant}
        <div class="cn-forms-merchanteditsheet-276-1 merchant-edit-form">
          <section class="cn-forms-merchanteditsheet-277-1">
            <FormSectionHeader
              title="Details"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("details")}
              onToggle={() => toggleSection("details")}
            />
            {#if isSectionOpen("details")}
              <div class="merchant-edit-section-body">
                <div class="beancount-structured-form">
                  <StructuredForm
                    value={merchant}
                    config={detailsForm}
                    embedded
                    context={undefined}
                    {issues}
                    onChange={handleChange}
                  />
                </div>
              </div>
            {/if}
          </section>

          <section class="cn-forms-merchanteditsheet-304-1">
            <FormSectionHeader
              title="Aliases"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("aliases")}
              onToggle={() => toggleSection("aliases")}
            />
            {#if isSectionOpen("aliases") && merchant.aliases.length}
              <div class="merchant-edit-section-body">
                <div class="cn-forms-merchanteditsheet-318-1">
                  {#each merchant.aliases as alias (alias.normalizedValue + alias.sourceId)}
                    <div class="cn-forms-merchanteditsheet-322-1">
                      <span class="cn-forms-merchanteditsheet-324-1"
                        >{alias.value}</span
                      >
                      <span class="cn-forms-merchanteditsheet-326-1"
                        >{alias.sourceId}</span
                      >
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>

          <section class="cn-forms-merchanteditsheet-336-1">
            <FormSectionHeader
              title="Provenance"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("provenance")}
              onToggle={() => toggleSection("provenance")}
            />
            {#if isSectionOpen("provenance") && merchant.provenance.length}
              <div class="merchant-edit-section-body">
                <div class="cn-forms-merchanteditsheet-350-1">
                  {#each merchant.provenance as entry, index (`${index}:${entry.source}:${entry.observedAt}`)}
                    <div class="cn-forms-merchanteditsheet-354-1">
                      <span class="cn-forms-merchanteditsheet-356-1"
                        >{entry.source}</span
                      >
                      <span class="cn-forms-merchanteditsheet-360-1"
                        >{provenanceSecondary(entry)}</span
                      >
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>

          <section class="cn-forms-merchanteditsheet-370-1">
            <FormSectionHeader
              title="Brand"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("brand")}
              onToggle={() => toggleSection("brand")}
            />
            {#if isSectionOpen("brand") && (merchant.brand || merchant.domain)}
              <div class="merchant-edit-section-body">
                <div class="beancount-structured-form">
                  {#if merchant.brand}
                    <FormField
                      label="Provider"
                      as="div"
                      align="center"
                      controlId="merchant-brand-provider"
                    >
                      <output
                        id="merchant-brand-provider"
                        class="cn-forms-merchanteditsheet-391-1"
                        >{merchant.brand.provider}</output
                      >
                    </FormField>
                    <FormField
                      label="Brand ID"
                      as="div"
                      align="center"
                      controlId="merchant-brand-id"
                    >
                      <output
                        id="merchant-brand-id"
                        class="cn-forms-merchanteditsheet-401-1"
                        >{merchant.brand.brandId ?? "—"}</output
                      >
                    </FormField>
                    <FormField
                      label="Fetched"
                      as="div"
                      align="center"
                      controlId="merchant-brand-fetched"
                    >
                      <output
                        id="merchant-brand-fetched"
                        class="cn-forms-merchanteditsheet-413-1"
                        >{formatTimestamp(merchant.brand.fetchedAt)}</output
                      >
                    </FormField>
                    <FormField
                      label="Next refresh"
                      as="div"
                      align="center"
                      controlId="merchant-brand-expires"
                    >
                      <output
                        id="merchant-brand-expires"
                        class="cn-forms-merchanteditsheet-425-1"
                        >{formatTimestamp(merchant.brand.expiresAt)}</output
                      >
                    </FormField>
                    <FormField
                      label="Cached logo"
                      as="div"
                      align="center"
                      controlId="merchant-brand-asset"
                    >
                      <output
                        id="merchant-brand-asset"
                        class="cn-forms-merchanteditsheet-435-1"
                        >{merchant.brand.asset
                          ? `${merchant.brand.asset.filename} · ${merchant.brand.asset.size ?? "legacy"}px · ${merchant.brand.asset.mediaType}`
                          : "—"}</output
                      >
                    </FormField>
                  {/if}
                  {#if merchant.domain}
                    <FormField
                      label="Logo"
                      as="div"
                      align="center"
                      controlId="merchant-brand-refresh"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={refreshingLogo}
                        onclick={() => onRefreshLogo?.()}
                      >
                        <RefreshCw
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        Refresh logo
                      </Button>
                    </FormField>
                  {/if}
                </div>
              </div>
            {/if}
          </section>
        </div>
      {/if}

      {#if status}
        <p class="cn-forms-merchanteditsheet-472-1" role="status">
          {status}
        </p>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  .merchant-edit-form :global(.beancount-structured-form) {
    min-width: 0;
  }

  .merchant-edit-section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-left: 0.5rem;
    min-width: 0;
  }

  :global(.merchant-edit-sheet-title) {
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .merchant-edit-form :global(.beancount-form-section-title-toggle),
  .merchant-edit-form :global(.beancount-form-section-title-row h3) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
