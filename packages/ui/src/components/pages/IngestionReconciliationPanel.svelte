<script module lang="ts">
  import type { BadgeVariant } from "../shadcn/badge";
  import type { FilterCommandOption } from "../forms/picker-options";

  export type ReconciliationPanelMember = {
    observationId: string;
    label: string;
    detail: string;
    account: string;
    color?: string;
    icon?: string;
    accountMerchantLogoUrl?: string;
    sourceLabel: string;
    sourceMerchantId?: string;
    sourceMerchantLogoUrl?: string;
    amount: string;
    currency: string;
  };

  export type ReconciliationPanelItem = {
    id: string;
    kind: string;
    kindLabel: string;
    confidence: string;
    confidenceLabel: string;
    confidenceVariant: BadgeVariant;
    evidenceSummary: string;
    decisionState?: string;
    chosenObservationId?: string;
    selectable: boolean;
    selectableTitle?: string;
    members: ReconciliationPanelMember[];
  };

  export type ReconciliationPanelSelectionState = {
    checked: boolean;
    indeterminate: boolean;
  };

  export type ReconciliationReviewSearchValues = {
    query: string;
    accounts: string[];
    sources: string[];
    years: string[];
    currencies: string[];
    kinds: string[];
    confidence: string[];
  };

  export type ReconciliationReviewFacetKey = Exclude<
    keyof ReconciliationReviewSearchValues,
    "query"
  >;

  export type ReconciliationReviewFacetOptions = {
    accounts: FilterCommandOption[];
    sources: FilterCommandOption[];
    years: FilterCommandOption[];
    currencies: FilterCommandOption[];
    kinds: FilterCommandOption[];
    confidence: FilterCommandOption[];
  };

  export type IngestionReconciliationPanelProps = {
    loadingInitial?: boolean;
    reviewLoaded?: boolean;
    error?: string;
    hasCandidates?: boolean;
    activeSearch?: boolean;
    matchedItemCount?: number;
    visibleItems?: readonly ReconciliationPanelItem[];
    actionableItemCount?: number;
    visibleActionableIds?: readonly string[];
    selectedCandidateIds?: ReadonlySet<string>;
    masterSelection?: ReconciliationPanelSelectionState;
    allMatchingSelected?: boolean;
    showSelectionBanner?: boolean;
    loading?: boolean;
    busyCandidateId?: string;
    bulkConfirming?: boolean;
    autoConfirming?: boolean;
    rechecking?: boolean;
    searchValues?: ReconciliationReviewSearchValues;
    facetOptions?: ReconciliationReviewFacetOptions;
    page?: number;
    pageCount?: number;
    pageSize?: number;
    pageSizeOptions?: readonly number[];
    onSearchQueryInput?: (value: string) => void;
    onClearSearch?: () => void;
    onClearAllSearch?: () => void;
    onFacetChange?: (key: ReconciliationReviewFacetKey, value: string[]) => void;
    onAutoConfirm?: () => void;
    onSetSelectedCandidates?: (
      candidateIds: readonly string[],
      selected: boolean,
    ) => void;
    onSelectAllMatching?: () => void;
    onClearSelected?: () => void;
    onApply?: (candidateId: string) => void;
    onDismiss?: (candidateId: string) => void;
    onConfirm?: (candidateId: string, canonicalObservationId: string) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };

  const DEFAULT_SEARCH_VALUES: ReconciliationReviewSearchValues = {
    query: "",
    accounts: [],
    sources: [],
    years: [],
    currencies: [],
    kinds: [],
    confidence: [],
  };

  const DEFAULT_FACET_OPTIONS: ReconciliationReviewFacetOptions = {
    accounts: [],
    sources: [],
    years: [],
    currencies: [],
    kinds: [],
    confidence: [],
  };

  const DEFAULT_SELECTION: ReconciliationPanelSelectionState = {
    checked: false,
    indeterminate: false,
  };

  const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];
</script>

<script lang="ts">
  import Check from "lucide-svelte/icons/check";
  import X from "lucide-svelte/icons/x";
  import { AccountAvatar } from "../forms";
  import { accountAvatarInitial } from "../forms/account-avatar";
  import FilterCommandPicker from "../forms/FilterCommandPicker.svelte";
  import SearchFilterBar from "../forms/SearchFilterBar.svelte";
  import { Badge } from "../shadcn/badge";
  import { Button } from "../shadcn/button";
  import ReconciliationReviewSkeleton from "../feedback/ReconciliationReviewSkeleton.svelte";
  import PagePagination from "../navigation/PagePagination.svelte";

  let {
    loadingInitial = false,
    reviewLoaded = false,
    error = "",
    hasCandidates = false,
    activeSearch = false,
    matchedItemCount = 0,
    visibleItems = [],
    actionableItemCount = 0,
    visibleActionableIds = [],
    selectedCandidateIds = new Set<string>(),
    masterSelection = DEFAULT_SELECTION,
    allMatchingSelected = false,
    showSelectionBanner = false,
    loading = false,
    busyCandidateId = "",
    bulkConfirming = false,
    autoConfirming = false,
    rechecking = false,
    searchValues = DEFAULT_SEARCH_VALUES,
    facetOptions = DEFAULT_FACET_OPTIONS,
    page = 1,
    pageCount = 1,
    pageSize = 10,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    onSearchQueryInput = () => {},
    onClearSearch = () => {},
    onClearAllSearch = () => {},
    onFacetChange = () => {},
    onAutoConfirm = () => {},
    onSetSelectedCandidates = () => {},
    onSelectAllMatching = () => {},
    onClearSelected = () => {},
    onApply = () => {},
    onDismiss = () => {},
    onConfirm = () => {},
    onPageChange = () => {},
    onPageSizeChange = () => {},
  }: IngestionReconciliationPanelProps = $props();

  let filtersExpanded = $state(false);
  let failedMerchantLogoIds = $state(new Set<string>());

  const actionDisabled = $derived(
    loading ||
      bulkConfirming ||
      autoConfirming ||
      rechecking ||
      Boolean(busyCandidateId),
  );

  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  }

  function markMerchantLogoFailed(merchantId: string) {
    failedMerchantLogoIds = new Set([...failedMerchantLogoIds, merchantId]);
  }
</script>

{#if loadingInitial}
  <ReconciliationReviewSkeleton />
{:else if hasCandidates}
  <div
    class="ingestion-page-search"
    style="--cv-search-filter-justify: stretch; --cv-search-filter-content-justify: stretch; --cv-search-filter-max-width: 100%;"
  >
    <SearchFilterBar
      inputMode="plain"
      value={searchValues.query}
      placeholder="Search reconciliation matches..."
      ariaLabel="Search reconciliation matches"
      clearSearchLabel="Clear search"
      clearAllLabel="Clear all filters"
      expandFiltersLabel="Expand filter options"
      collapseFiltersLabel="Collapse filter options"
      showActiveQueryChip={true}
      showFilterToggle={true}
      showClearAll={activeSearch}
      clearAllDisabled={!activeSearch}
      bind:filtersExpanded
      onValueChange={onSearchQueryInput}
      onClearSearch={onClearSearch}
      onClearAll={onClearAllSearch}
    >
      {#snippet filters()}
        <div class="ingestion-page-search__facet-row">
          <FilterCommandPicker
            multiple
            label="Account"
            values={searchValues.accounts}
            options={facetOptions.accounts}
            placeholder="Filter by account..."
            onValuesChange={(accounts) => onFacetChange("accounts", accounts)}
          />
          <FilterCommandPicker
            multiple
            label="Source"
            values={searchValues.sources}
            options={facetOptions.sources}
            placeholder="Filter by source..."
            onValuesChange={(sources) => onFacetChange("sources", sources)}
          />
          <FilterCommandPicker
            multiple
            label="Reason"
            values={searchValues.kinds}
            options={facetOptions.kinds}
            placeholder="Filter by reason..."
            onValuesChange={(kinds) => onFacetChange("kinds", kinds)}
          />
          <FilterCommandPicker
            multiple
            label="Confidence"
            values={searchValues.confidence}
            options={facetOptions.confidence}
            placeholder="Filter by confidence..."
            onValuesChange={(confidence) =>
              onFacetChange("confidence", confidence)}
          />
          <FilterCommandPicker
            multiple
            label="Year"
            values={searchValues.years}
            options={facetOptions.years}
            placeholder="Filter by year..."
            onValuesChange={(years) => onFacetChange("years", years)}
          />
          <FilterCommandPicker
            multiple
            label="Currency"
            values={searchValues.currencies}
            options={facetOptions.currencies}
            placeholder="Filter by currency..."
            onValuesChange={(currencies) =>
              onFacetChange("currencies", currencies)}
          />
        </div>
      {/snippet}
      {#snippet collapsedFilters()}
        <div class="ingestion-page-search__facet-row">
          {#if searchValues.accounts.length}
            <FilterCommandPicker
              multiple
              label="Account"
              values={searchValues.accounts}
              options={facetOptions.accounts}
              onValuesChange={(accounts) => onFacetChange("accounts", accounts)}
            />
          {/if}
          {#if searchValues.sources.length}
            <FilterCommandPicker
              multiple
              label="Source"
              values={searchValues.sources}
              options={facetOptions.sources}
              onValuesChange={(sources) => onFacetChange("sources", sources)}
            />
          {/if}
          {#if searchValues.kinds.length}
            <FilterCommandPicker
              multiple
              label="Reason"
              values={searchValues.kinds}
              options={facetOptions.kinds}
              onValuesChange={(kinds) => onFacetChange("kinds", kinds)}
            />
          {/if}
          {#if searchValues.confidence.length}
            <FilterCommandPicker
              multiple
              label="Confidence"
              values={searchValues.confidence}
              options={facetOptions.confidence}
              onValuesChange={(confidence) =>
                onFacetChange("confidence", confidence)}
            />
          {/if}
          {#if searchValues.years.length}
            <FilterCommandPicker
              multiple
              label="Year"
              values={searchValues.years}
              options={facetOptions.years}
              onValuesChange={(years) => onFacetChange("years", years)}
            />
          {/if}
          {#if searchValues.currencies.length}
            <FilterCommandPicker
              multiple
              label="Currency"
              values={searchValues.currencies}
              options={facetOptions.currencies}
              onValuesChange={(currencies) =>
                onFacetChange("currencies", currencies)}
            />
          {/if}
        </div>
      {/snippet}
    </SearchFilterBar>
  </div>

  {#if activeSearch && !matchedItemCount}
    <div
      class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
    >
      No reconciliation matches this search.
    </div>
  {:else if matchedItemCount}
    <div class="flex justify-end">
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-reconciliation-auto-confirm
        disabled={actionDisabled}
        onclick={onAutoConfirm}
      >
        <Check data-icon="inline-start" />
        {autoConfirming
          ? "Auto-confirming exact matches..."
          : "Auto-confirm exact mapped matches"}
      </Button>
    </div>

    <div
      class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <input
        use:setIndeterminate={masterSelection.indeterminate}
        type="checkbox"
        class="size-4 rounded border-input text-primary focus:ring-ring"
        aria-label="Select visible reconciliation matches"
        checked={masterSelection.checked}
        disabled={!visibleActionableIds.length ||
          bulkConfirming ||
          autoConfirming ||
          rechecking}
        onchange={(event) =>
          onSetSelectedCandidates(
            visibleActionableIds,
            (event.currentTarget as HTMLInputElement).checked,
          )}
      />
      <span>Match</span>
      <span class="text-right">Actions</span>
    </div>

    {#if showSelectionBanner}
      <div
        data-reconciliation-selection-banner
        role="status"
        class="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
      >
        {#if allMatchingSelected}
          All {actionableItemCount} matching reconciliation items selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={onClearSelected}
          >
            Clear selection
          </button>
        {:else}
          All {visibleActionableIds.length} actionable matches on this page are
          selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={onSelectAllMatching}
          >
            Select all {actionableItemCount} matching items
          </button>
        {/if}
      </div>
    {/if}

    <div class="flex flex-col gap-3" data-ingestion-reconciliation>
      {#each visibleItems as item (item.id)}
        {@const busy = busyCandidateId === item.id}
        <section class="overflow-hidden rounded-2xl bg-muted/80">
          <div
            class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-4 sm:px-5"
          >
            <input
              type="checkbox"
              class="mt-0.5 size-4 rounded border-input text-primary focus:ring-ring"
              aria-label={`Select ${item.kindLabel}`}
              title={item.selectableTitle}
              checked={selectedCandidateIds.has(item.id)}
              disabled={!item.selectable ||
                bulkConfirming ||
                autoConfirming ||
                rechecking}
              onchange={(event) =>
                onSetSelectedCandidates(
                  [item.id],
                  (event.currentTarget as HTMLInputElement).checked,
                )}
            />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2
                  class="text-sm font-semibold tracking-[0.08em] text-muted-foreground [font-variant:all-small-caps]"
                  data-reconciliation-kind
                >
                  {item.kindLabel}
                </h2>
                <Badge
                  variant={item.confidenceVariant}
                  class="rounded-full"
                  data-reconciliation-confidence={item.confidence}
                  >{item.confidenceLabel}</Badge
                >
              </div>
            </div>
            <div
              class="flex shrink-0 flex-wrap items-center justify-end gap-1"
              data-reconciliation-actions
            >
              {#if item.decisionState === "confirmed"}
                <Button
                  size="icon-sm"
                  variant="ghost-raised"
                  aria-label="Apply confirmed match"
                  title="Apply confirmed match"
                  data-reconciliation-action="apply"
                  disabled={busy || actionDisabled}
                  onclick={() => onApply(item.id)}
                >
                  <Check data-icon />
                </Button>
              {:else}
                <Button
                  size="icon-sm"
                  variant="ghost-raised"
                  aria-label="Not a match"
                  title="Not a match"
                  data-reconciliation-action="dismiss"
                  disabled={busy || actionDisabled}
                  onclick={() => onDismiss(item.id)}
                >
                  <X data-icon />
                </Button>
                {#if item.chosenObservationId}
                  <Button
                    size="icon-sm"
                    variant="ghost-raised"
                    aria-label="Confirm match"
                    title="Confirm match"
                    data-reconciliation-action="confirm"
                    disabled={busy || actionDisabled}
                    onclick={() => onConfirm(item.id, item.chosenObservationId ?? "")}
                  >
                    <Check data-icon />
                  </Button>
                {:else}
                  {#each item.members as member (member.observationId)}
                    <Button
                      size="icon-sm"
                      variant="ghost-raised"
                      aria-label={`Use ${member.label} as the canonical record`}
                      title={`Use ${member.label} as the canonical record`}
                      data-reconciliation-action="confirm"
                      disabled={busy || actionDisabled}
                      onclick={() => onConfirm(item.id, member.observationId)}
                    >
                      <Check data-icon />
                    </Button>
                  {/each}
                {/if}
              {/if}
            </div>
            <p
              class="col-span-full text-xs leading-relaxed text-muted-foreground"
            >
              {item.evidenceSummary}
            </p>
          </div>

          <div
            class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            {#each item.members as member, memberIndex (member.observationId)}
              <div
                class:rounded-b-xl={memberIndex === item.members.length - 1}
                class="grid grid-cols-[2.5rem_minmax(0,1fr)_7rem] items-center gap-x-3 gap-y-1 border-b px-[15px] py-4 transition-colors last:border-b-0 hover:bg-accent/60 sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_7rem]"
                data-reconciliation-member-row
              >
                <div
                  class="col-start-1 row-span-2 row-start-1 sm:row-span-1"
                  aria-hidden="true"
                  data-reconciliation-member-avatar
                >
                  <AccountAvatar
                    account={member.account || member.label}
                    color={member.color ?? ""}
                    icon={member.icon ?? ""}
                    merchantLogoUrl={member.accountMerchantLogoUrl}
                  />
                </div>
                <div
                  class="col-start-2 row-span-2 row-start-1 min-w-0 self-center sm:row-span-1"
                  data-reconciliation-member-details
                >
                  <div class="break-words text-sm font-semibold sm:truncate">
                    {member.label}
                  </div>
                  <div
                    class="mt-1 break-words text-xs text-muted-foreground sm:truncate"
                  >
                    {member.detail}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  class="pointer-events-none col-start-3 row-start-1 max-w-full gap-1 justify-self-center truncate rounded-full bg-card text-[10px] uppercase tracking-wide text-muted-foreground"
                  aria-label={`Source ${member.sourceLabel}`}
                  data-reconciliation-member-source
                >
                  {#if member.sourceMerchantLogoUrl && member.sourceMerchantId && !failedMerchantLogoIds.has(member.sourceMerchantId)}
                    <img
                      class="size-3.5 rounded-full object-cover"
                      src={member.sourceMerchantLogoUrl}
                      alt=""
                      onerror={() =>
                        member.sourceMerchantId
                          ? markMerchantLogoFailed(member.sourceMerchantId)
                          : undefined}
                    />
                  {:else}
                    <span
                      class="grid size-3.5 shrink-0 place-items-center rounded-full bg-rose-200 text-[0.5rem] font-semibold text-rose-800"
                      aria-hidden="true"
                    >
                      {accountAvatarInitial(member.sourceLabel)}
                    </span>
                  {/if}
                  {member.sourceLabel}
                </Badge>
                <span
                  class="col-start-3 row-start-2 justify-self-end text-sm font-semibold tabular-nums sm:col-start-4 sm:row-start-1"
                  data-reconciliation-member-amount
                >
                  {member.amount}&nbsp;{member.currency}
                </span>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>

    {#if pageCount > 1}
      <div
        class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-reconciliation-pagination
      >
        <span class="text-sm text-muted-foreground"
          >Page {page} of {pageCount}</span
        >
        <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div class="hidden items-center gap-2 sm:flex">
            <label
              class="text-sm text-muted-foreground"
              for="reconciliation-review-page-size">Matches per page</label
            >
            <select
              id="reconciliation-review-page-size"
              class="h-8 rounded-md border bg-background px-2 text-sm"
              value={pageSize}
              onchange={(event) =>
                onPageSizeChange(
                  Number((event.currentTarget as HTMLSelectElement).value),
                )}
            >
              {#each pageSizeOptions as size (size)}
                <option value={size}>{size}</option>
              {/each}
            </select>
          </div>
          <PagePagination
            {page}
            {pageCount}
            ariaLabel="Reconciliation match pages"
            disabled={actionDisabled}
            onPageChange={onPageChange}
          />
        </div>
      </div>
    {/if}
  {/if}
{:else if reviewLoaded && !error}
  <div
    class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
  >
    No reconciliation matches are available.
  </div>
{:else if error}
  <p class="text-sm text-destructive" role="status">{error}</p>
{/if}

<style>
  .ingestion-page-search :global(.cv-search-filter-bar) {
    padding: 0;
  }

  .ingestion-page-search :global(.cv-search-filter-bar__search-pill) {
    flex: 1 1 100%;
    width: 100%;
    max-width: none;
  }

  .ingestion-page-search__facet-row {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
</style>
