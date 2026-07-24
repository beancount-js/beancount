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
    class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl [&>button.absolute]:hidden"
    data-merchant-edit-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header
      class="flex h-11 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-3 text-left"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        {#if merchant?.logoUrl && !failedLogo}
          <img
            class="size-8 shrink-0 rounded-full border object-contain"
            src={merchant.logoUrl}
            alt=""
            onerror={handleLogoError}
          />
        {:else if merchant}
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            {merchantInitial}
          </div>
        {/if}
        <Sheet.Title
          bind:ref={sheetTitleEl}
          tabindex={-1}
          class="merchant-edit-sheet-title min-w-0 truncate leading-none outline-none"
        >
          {headerTitle}
        </Sheet.Title>
      </div>
      <Sheet.Description class="sr-only">
        Edit saved merchant profile {headerTitle}.
      </Sheet.Description>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                class="size-8"
                aria-label={sectionsCollapsedAll
                  ? "Expand all"
                  : "Collapse all"}
                onclick={(event) => {
                  toggleCollapseAll();
                }}
              >
                {#if sectionsCollapsedAll}
                  <ChevronsUpDown class="size-4" aria-hidden="true" />
                {:else}
                  <ChevronsDownUp class="size-4" aria-hidden="true" />
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
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X class="size-4" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      {#if loadError && !merchant}
        <Alert.Root variant="destructive" class="mb-3">
          <CircleAlert />
          <Alert.Title>Could not load merchant</Alert.Title>
          <Alert.Description class="whitespace-pre-wrap"
            >{loadError}</Alert.Description
          >
        </Alert.Root>
      {/if}

      {#if loading && !merchant}
        <p class="text-sm text-muted-foreground">Loading merchant…</p>
      {:else if merchant}
        <div class="merchant-edit-form flex min-w-0 flex-col gap-6 pl-6">
          <section class="flex flex-col gap-2">
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

          <section class="flex flex-col gap-2">
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
                <div
                  class="overflow-hidden rounded-lg border bg-card text-sm shadow-sm"
                >
                  {#each merchant.aliases as alias (alias.normalizedValue + alias.sourceId)}
                    <div
                      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 last:border-b-0"
                    >
                      <span class="min-w-0 truncate">{alias.value}</span>
                      <span
                        class="truncate text-xs tabular-nums text-muted-foreground"
                        >{alias.sourceId}</span
                      >
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>

          <section class="flex flex-col gap-2">
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
                <div
                  class="overflow-hidden rounded-lg border bg-card text-sm shadow-sm"
                >
                  {#each merchant.provenance as entry, index (`${index}:${entry.source}:${entry.observedAt}`)}
                    <div
                      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 last:border-b-0"
                    >
                      <span class="min-w-0 truncate capitalize"
                        >{entry.source}</span
                      >
                      <span
                        class="truncate text-xs tabular-nums text-muted-foreground"
                        >{provenanceSecondary(entry)}</span
                      >
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>

          <section class="flex flex-col gap-2">
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
                      <output id="merchant-brand-provider" class="truncate"
                        >{merchant.brand.provider}</output
                      >
                    </FormField>
                    <FormField
                      label="Brand ID"
                      as="div"
                      align="center"
                      controlId="merchant-brand-id"
                    >
                      <output id="merchant-brand-id" class="truncate"
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
                        class="truncate tabular-nums"
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
                        class="truncate tabular-nums"
                        >{formatTimestamp(merchant.brand.expiresAt)}</output
                      >
                    </FormField>
                    <FormField
                      label="Cached logo"
                      as="div"
                      align="center"
                      controlId="merchant-brand-asset"
                    >
                      <output id="merchant-brand-asset" class="truncate"
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
        <p class="mt-3 text-sm text-muted-foreground" role="status">
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
