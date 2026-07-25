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
    onFacetChange?: (
      key: ReconciliationReviewFacetKey,
      value: string[],
    ) => void;
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
      {onClearSearch}
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
    <div class="cn-pages-ingestionreconciliationpanel-355-1">
      No reconciliation matches this search.
    </div>
  {:else if matchedItemCount}
    <div class="cn-pages-ingestionreconciliationpanel-360-1">
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

    <div class="cn-pages-ingestionreconciliationpanel-377-1">
      <input
        use:setIndeterminate={masterSelection.indeterminate}
        type="checkbox"
        class="cn-pages-ingestionreconciliationpanel-382-1"
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
      <span class="cn-pages-ingestionreconciliationpanel-396-1">Actions</span>
    </div>

    {#if showSelectionBanner}
      <div
        data-reconciliation-selection-banner
        role="status"
        class="cn-pages-ingestionreconciliationpanel-403-1"
      >
        {#if allMatchingSelected}
          All {actionableItemCount} matching reconciliation items selected.
          <button
            type="button"
            class="cn-pages-ingestionreconciliationpanel-409-1"
            onclick={onClearSelected}
          >
            Clear selection
          </button>
        {:else}
          All {visibleActionableIds.length} actionable matches on this page are selected.
          <button
            type="button"
            class="cn-pages-ingestionreconciliationpanel-419-1"
            onclick={onSelectAllMatching}
          >
            Select all {actionableItemCount} matching items
          </button>
        {/if}
      </div>
    {/if}

    <div
      class="cn-pages-ingestionreconciliationpanel-428-1"
      data-ingestion-reconciliation
    >
      {#each visibleItems as item (item.id)}
        {@const busy = busyCandidateId === item.id}
        <section class="cn-pages-ingestionreconciliationpanel-431-1">
          <div class="cn-pages-ingestionreconciliationpanel-433-1">
            <input
              type="checkbox"
              class="cn-pages-ingestionreconciliationpanel-437-1"
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
            <div class="cn-pages-ingestionreconciliationpanel-451-1">
              <div class="cn-pages-ingestionreconciliationpanel-452-1">
                <h2
                  class="cn-pages-ingestionreconciliationpanel-454-1"
                  data-reconciliation-kind
                >
                  {item.kindLabel}
                </h2>
                <Badge
                  variant={item.confidenceVariant}
                  class="cn-pages-ingestionreconciliationpanel-461-1"
                  data-reconciliation-confidence={item.confidence}
                  >{item.confidenceLabel}</Badge
                >
              </div>
            </div>
            <div
              class="cn-pages-ingestionreconciliationpanel-468-1"
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
                    onclick={() =>
                      onConfirm(item.id, item.chosenObservationId ?? "")}
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
            <p class="cn-pages-ingestionreconciliationpanel-525-1">
              {item.evidenceSummary}
            </p>
          </div>

          <div class="cn-pages-ingestionreconciliationpanel-532-1">
            {#each item.members as member, memberIndex (member.observationId)}
              <div
                class:cn-pages-ingestionreconciliationpanel-536-1={memberIndex ===
                  item.members.length - 1}
                class="cn-pages-ingestionreconciliationpanel-537-1"
                data-reconciliation-member-row
              >
                <div
                  class="cn-pages-ingestionreconciliationpanel-541-1"
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
                  class="cn-pages-ingestionreconciliationpanel-553-1"
                  data-reconciliation-member-details
                >
                  <div class="cn-pages-ingestionreconciliationpanel-556-1">
                    {member.label}
                  </div>
                  <div class="cn-pages-ingestionreconciliationpanel-560-1">
                    {member.detail}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  class="cn-pages-ingestionreconciliationpanel-567-1"
                  aria-label={`Source ${member.sourceLabel}`}
                  data-reconciliation-member-source
                >
                  {#if member.sourceMerchantLogoUrl && member.sourceMerchantId && !failedMerchantLogoIds.has(member.sourceMerchantId)}
                    <img
                      class="cn-pages-ingestionreconciliationpanel-573-1"
                      src={member.sourceMerchantLogoUrl}
                      alt=""
                      onerror={() =>
                        member.sourceMerchantId
                          ? markMerchantLogoFailed(member.sourceMerchantId)
                          : undefined}
                    />
                  {:else}
                    <span
                      class="cn-pages-ingestionreconciliationpanel-583-1"
                      aria-hidden="true"
                    >
                      {accountAvatarInitial(member.sourceLabel)}
                    </span>
                  {/if}
                  {member.sourceLabel}
                </Badge>
                <span
                  class="cn-pages-ingestionreconciliationpanel-592-1"
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
        class="cn-pages-ingestionreconciliationpanel-606-1"
        data-reconciliation-pagination
      >
        <span class="cn-pages-ingestionreconciliationpanel-609-1"
          >Page {page} of {pageCount}</span
        >
        <div class="cn-pages-ingestionreconciliationpanel-612-1">
          <div class="cn-pages-ingestionreconciliationpanel-613-1">
            <label
              class="cn-pages-ingestionreconciliationpanel-615-1"
              for="reconciliation-review-page-size">Matches per page</label
            >
            <select
              id="reconciliation-review-page-size"
              class="cn-pages-ingestionreconciliationpanel-620-1"
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
            {onPageChange}
          />
        </div>
      </div>
    {/if}
  {/if}
{:else if reviewLoaded && !error}
  <div class="cn-pages-ingestionreconciliationpanel-645-1">
    No reconciliation matches are available.
  </div>
{:else if error}
  <p class="cn-pages-ingestionreconciliationpanel-650-1" role="status">
    {error}
  </p>
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
