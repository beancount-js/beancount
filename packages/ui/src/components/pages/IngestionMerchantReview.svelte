<script module lang="ts">
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import type { FilterCommandOption } from "../forms/picker-options";
  import type { SearchFilterSyntax } from "../forms/search-filter-syntax";

  export type MerchantReviewView = "pending" | "reviewed";
  export type MerchantReviewSortKey = "merchant" | "pending";
  export type MerchantReviewSortOrder = "none" | "asc" | "desc";

  export type MerchantReviewSelectionState = {
    checked: boolean;
    indeterminate: boolean;
  };

  export type IngestionMerchantReviewProps = {
    isWeb?: boolean;
    hasProject?: boolean;
    loading?: boolean;
    status?: string;
    hasMerchantClusters?: boolean;
    hasSources?: boolean;
    merchantView?: MerchantReviewView;
    pendingCount?: number;
    reviewedCount?: number;
    clusters?: readonly MerchantReviewCluster[];
    matchedClusters?: readonly MerchantReviewCluster[];
    visibleClusters?: readonly MerchantReviewCluster[];
    summaryLine?: string;
    activeSearch?: boolean;
    searchQuery?: string;
    searchStatuses?: string[];
    searchDomain?: string;
    statusOptions?: FilterCommandOption[];
    domainOptions?: FilterCommandOption[];
    filterSyntax?: SearchFilterSyntax;
    sortOrders?: Record<MerchantReviewSortKey, MerchantReviewSortOrder>;
    masterSelection?: MerchantReviewSelectionState;
    selectedClusterIds?: ReadonlySet<string>;
    visibleClusterIds?: readonly string[];
    allMatchingSelected?: boolean;
    showSelectionBanner?: boolean;
    detectBusy?: boolean;
    page?: number;
    pageCount?: number;
    pageSize?: number;
    pageSizeOptions?: readonly number[];
    onMerchantViewChange?: (view: MerchantReviewView) => void;
    onSearchQueryInput?: (value: string) => void;
    onClearSearch?: () => void;
    onClearAllSearch?: () => void;
    onSearchStatusesChange?: (statuses: string[]) => void;
    onSearchDomainChange?: (domain: string) => void;
    onCycleSort?: (key: MerchantReviewSortKey) => void;
    onSetSelectedClusters?: (
      clusterIds: readonly string[],
      selected: boolean,
    ) => void;
    onSelectAllMatching?: () => void;
    onClearSelected?: () => void;
    onOpenCluster?: (cluster: MerchantReviewCluster) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    onOpenAccounts?: () => void;
    onOpenSources?: () => void;
  };

  const DEFAULT_SORT_ORDERS: Record<
    MerchantReviewSortKey,
    MerchantReviewSortOrder
  > = {
    merchant: "none",
    pending: "none",
  };

  const DEFAULT_SELECTION: MerchantReviewSelectionState = {
    checked: false,
    indeterminate: false,
  };
</script>

<script lang="ts">
  import ArrowDownWideNarrow from "lucide-svelte/icons/arrow-down-wide-narrow";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import ArrowUpNarrowWide from "lucide-svelte/icons/arrow-up-narrow-wide";
  import Landmark from "lucide-svelte/icons/landmark";
  import Link2 from "lucide-svelte/icons/link-2";
  import { Badge } from "../shadcn/badge";
  import { Button } from "../shadcn/button";
  import * as Empty from "../shadcn/empty";
  import * as ToggleGroup from "../shadcn/toggle-group";
  import FilterCommandPicker from "../forms/FilterCommandPicker.svelte";
  import SearchFilterBar from "../forms/SearchFilterBar.svelte";
  import MerchantsPageSkeleton from "../feedback/MerchantsPageSkeleton.svelte";
  import PagePagination from "../navigation/PagePagination.svelte";

  const DEFAULT_PAGE_SIZES = [25, 50, 100];

  let {
    isWeb = false,
    hasProject = false,
    loading = false,
    status = "",
    hasMerchantClusters = false,
    hasSources = false,
    merchantView = "pending",
    pendingCount = 0,
    reviewedCount = 0,
    clusters = [],
    matchedClusters = [],
    visibleClusters = [],
    summaryLine = "",
    activeSearch = false,
    searchQuery = "",
    searchStatuses = [],
    searchDomain = "",
    statusOptions = [],
    domainOptions = [],
    filterSyntax = undefined,
    sortOrders = DEFAULT_SORT_ORDERS,
    masterSelection = DEFAULT_SELECTION,
    selectedClusterIds = new Set<string>(),
    visibleClusterIds = [],
    allMatchingSelected = false,
    showSelectionBanner = false,
    detectBusy = false,
    page = 1,
    pageCount = 1,
    pageSize = 50,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    onMerchantViewChange = () => {},
    onSearchQueryInput = () => {},
    onClearSearch = () => {},
    onClearAllSearch = () => {},
    onSearchStatusesChange = () => {},
    onSearchDomainChange = () => {},
    onCycleSort = () => {},
    onSetSelectedClusters = () => {},
    onSelectAllMatching = () => {},
    onClearSelected = () => {},
    onOpenCluster = () => {},
    onPageChange = () => {},
    onPageSizeChange = () => {},
    onOpenAccounts = () => {},
    onOpenSources = () => {},
  }: IngestionMerchantReviewProps = $props();

  let failedLogoIds = $state(new Set<string>());
  let filtersExpanded = $state(false);

  const isPendingView = $derived(merchantView === "pending");

  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  }

  function clusterInitial(cluster: MerchantReviewCluster) {
    return cluster.displayName.slice(0, 1).toUpperCase() || "?";
  }

  function clusterDetail(cluster: MerchantReviewCluster) {
    const labels = cluster.members
      .map((member) => member.rawLabel)
      .slice(0, 2)
      .join(", ");
    const more =
      cluster.members.length > 2 ? ` +${cluster.members.length - 2} more` : "";
    const domain = cluster.domain ? `${cluster.domain} · ` : "";
    return `${domain}${labels}${more}`;
  }

  function merchantClusterConfidence(cluster: MerchantReviewCluster) {
    const scores = cluster.candidates
      .map((candidate) => candidate.rawScore)
      .filter(
        (score): score is number =>
          typeof score === "number" && Number.isFinite(score),
      );
    return scores.length ? Math.max(...scores) : undefined;
  }

  function formatAiConfidence(score: number) {
    return `${Math.round(score * 100)}%`;
  }

  function markLogoFailed(clusterId: string) {
    failedLogoIds = new Set([...failedLogoIds, clusterId]);
  }

  function sortIconLabel(key: MerchantReviewSortKey) {
    const order = sortOrders[key];
    if (order === "asc") return "ascending";
    if (order === "desc") return "descending";
    return "not sorted";
  }
</script>

<section class="h-full overflow-auto p-3 sm:p-5" data-ingestion-merchant-review>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if isWeb}
      <div
        class="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
      >
        Merchant review is available only when this project is opened through
        the local Beancount Studio server.
      </div>
    {:else if !hasProject}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Open a project to review merchants.
      </div>
    {:else}
      {#if status}
        <p class="text-sm text-muted-foreground" role="status">{status}</p>
      {/if}

      {#if loading && !hasMerchantClusters}
        <MerchantsPageSkeleton />
      {:else if hasMerchantClusters}
        <ToggleGroup.Root
          type="single"
          value={merchantView}
          aria-label="Merchant review status"
          class="!gap-0 self-start rounded-lg bg-muted p-1"
          data-ingestion-merchant-view
          onValueChange={(value) => {
            if (value === "pending" || value === "reviewed") {
              onMerchantViewChange(value);
            }
          }}
        >
          <ToggleGroup.Item
            value="pending"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-3 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            Pending review
            <span
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
            >
              {pendingCount}
            </span>
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="reviewed"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-3 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            Reviewed
            <span
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
            >
              {reviewedCount}
            </span>
          </ToggleGroup.Item>
        </ToggleGroup.Root>

        {#if clusters.length}
          {#if summaryLine}
            <p class="text-sm text-muted-foreground">{summaryLine}</p>
          {/if}

          <div
            class="ingestion-page-search"
            style="--cv-search-filter-justify: stretch; --cv-search-filter-content-justify: stretch; --cv-search-filter-max-width: 100%;"
          >
            <SearchFilterBar
              value={searchQuery}
              placeholder="Search merchants... e.g. confidence >= 0.9"
              ariaLabel="Search merchants"
              clearSearchLabel="Clear search"
              clearAllLabel="Clear all filters"
              expandFiltersLabel="Expand filter options"
              collapseFiltersLabel="Collapse filter options"
              showActiveQueryChip={true}
              showFilterToggle={true}
              showClearAll={activeSearch}
              clearAllDisabled={!activeSearch}
              bind:filtersExpanded
              {filterSyntax}
              onValueChange={onSearchQueryInput}
              onClearSearch={onClearSearch}
              onClearAll={onClearAllSearch}
            >
              {#snippet filters()}
                <div class="ingestion-page-search__facet-row">
                  <FilterCommandPicker
                    multiple
                    label="Status"
                    values={searchStatuses}
                    options={statusOptions}
                    placeholder="Filter by status..."
                    onValuesChange={onSearchStatusesChange}
                  />
                  <FilterCommandPicker
                    label="Domain"
                    value={searchDomain}
                    options={domainOptions}
                    placeholder="Filter by domain..."
                    onChange={onSearchDomainChange}
                  />
                </div>
              {/snippet}
              {#snippet collapsedFilters()}
                <div class="ingestion-page-search__facet-row">
                  {#if searchStatuses.length > 0}
                    <FilterCommandPicker
                      multiple
                      label="Status"
                      values={searchStatuses}
                      options={statusOptions}
                      onValuesChange={onSearchStatusesChange}
                    />
                  {/if}
                  {#if searchDomain}
                    <FilterCommandPicker
                      label="Domain"
                      value={searchDomain}
                      options={domainOptions}
                      onChange={onSearchDomainChange}
                    />
                  {/if}
                </div>
              {/snippet}
            </SearchFilterBar>
          </div>

          {#if activeSearch && !matchedClusters.length}
            <div
              class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
            >
              No merchants match this search.
            </div>
          {:else if matchedClusters.length}
            <div
              class={isPendingView
                ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"}
            >
              {#if isPendingView}
                <input
                  use:setIndeterminate={masterSelection.indeterminate}
                  type="checkbox"
                  class="size-4 rounded border-input text-primary focus:ring-ring"
                  aria-label="Select visible merchant clusters"
                  checked={masterSelection.checked}
                  disabled={!visibleClusterIds.length || detectBusy}
                  onchange={(event) =>
                    onSetSelectedClusters(
                      visibleClusterIds,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
              {/if}
              <div class="justify-self-start">
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Sort by merchant, currently ${sortIconLabel("merchant")}`}
                  onclick={() => onCycleSort("merchant")}
                >
                  Merchant
                  {#if sortOrders.merchant === "asc"}
                    <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
                  {:else if sortOrders.merchant === "desc"}
                    <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
                  {:else}
                    <ArrowUpDown
                      class="size-3.5 opacity-50"
                      aria-hidden="true"
                    />
                  {/if}
                </button>
              </div>
              <div class="justify-self-end">
                <button
                  type="button"
                  class="inline-flex items-center justify-end gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Sort by ${isPendingView ? "pending" : "reviewed"} count, currently ${sortIconLabel("pending")}`}
                  onclick={() => onCycleSort("pending")}
                >
                  {isPendingView ? "Pending" : "Reviewed"}
                  {#if sortOrders.pending === "asc"}
                    <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
                  {:else if sortOrders.pending === "desc"}
                    <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
                  {:else}
                    <ArrowUpDown
                      class="size-3.5 opacity-50"
                      aria-hidden="true"
                    />
                  {/if}
                </button>
              </div>
            </div>

            {#if showSelectionBanner}
              <div
                data-merchant-selection-banner
                role="status"
                class="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
              >
                {#if allMatchingSelected}
                  All {matchedClusters.length} matching merchant clusters are selected.
                  <button
                    type="button"
                    class="font-medium text-primary underline-offset-2 hover:underline"
                    onclick={onClearSelected}
                  >
                    Clear selection
                  </button>
                {:else}
                  All {visibleClusterIds.length} merchant clusters on this page are
                  selected.
                  <button
                    type="button"
                    class="font-medium text-primary underline-offset-2 hover:underline"
                    onclick={onSelectAllMatching}
                  >
                    Select all {matchedClusters.length} matching clusters
                  </button>
                {/if}
              </div>
            {/if}

            <div class="mx-1 overflow-hidden rounded-xl border bg-card shadow-sm">
              {#each visibleClusters as cluster (cluster.id)}
                {@const confidence = merchantClusterConfidence(cluster)}
                <div
                  class={isPendingView
                    ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b px-[15px] py-4 transition-colors last:border-b-0 hover:bg-accent/60"
                    : "border-b px-[15px] py-4 transition-colors last:border-b-0 hover:bg-accent/60"}
                >
                  {#if isPendingView}
                    <input
                      type="checkbox"
                      class="size-4 rounded border-input text-primary focus:ring-ring"
                      aria-label={`Select ${cluster.displayName}`}
                      checked={selectedClusterIds.has(cluster.id)}
                      disabled={detectBusy}
                      onchange={(event) =>
                        onSetSelectedClusters(
                          [cluster.id],
                          (event.currentTarget as HTMLInputElement).checked,
                        )}
                    />
                  {/if}
                  <button
                    type="button"
                    class="grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-transparent p-0 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${isPendingView ? "Review" : "View"} merchant ${cluster.displayName}`}
                    onclick={() => onOpenCluster(cluster)}
                  >
                    {#if cluster.logoUrl && !failedLogoIds.has(cluster.id)}
                      <img
                        class="size-10 rounded-full border object-contain"
                        src={cluster.logoUrl}
                        alt=""
                        onerror={() => markLogoFailed(cluster.id)}
                      />
                    {:else}
                      <div
                        class="flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground"
                        aria-hidden="true"
                      >
                        {clusterInitial(cluster)}
                      </div>
                    {/if}
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold">
                        {cluster.displayName}
                      </div>
                      <div
                        class="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span class="min-w-0 truncate">
                          <span class="capitalize"
                            >{cluster.statuses[0] ?? "unresolved"}</span
                          >
                          · {clusterDetail(cluster)}
                        </span>
                        {#if confidence !== undefined}
                          <Badge
                            variant="secondary"
                            class="shrink-0 px-1.5 py-0 text-[0.65rem] leading-5"
                            title={`AI merchant confidence ${confidence.toFixed(2)}`}
                            >AI {formatAiConfidence(confidence)}</Badge
                          >
                        {/if}
                      </div>
                    </div>
                    <span
                      class={isPendingView
                        ? "inline-flex min-w-7 justify-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-violet-700 dark:text-violet-300"
                        : "inline-flex min-w-7 justify-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"}
                      aria-label={`${cluster.pendingCount} ${isPendingView ? "pending" : "reviewed"} transaction${cluster.pendingCount === 1 ? "" : "s"}`}
                    >
                      {cluster.pendingCount}
                    </span>
                  </button>
                </div>
              {/each}
            </div>

            {#if pageCount > 1}
              <div
                class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                data-review-merchant-pagination
              >
                <span class="text-sm text-muted-foreground"
                  >Page {page} of {pageCount}</span
                >
                <div
                  class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <div class="hidden items-center gap-2 sm:flex">
                    <label
                      class="text-sm text-muted-foreground"
                      for="ingestion-merchant-page-size">Records per page</label
                    >
                    <select
                      id="ingestion-merchant-page-size"
                      class="h-8 rounded-md border bg-background px-2 text-sm"
                      value={pageSize}
                      onchange={(event) =>
                        onPageSizeChange(
                          Number(
                            (event.currentTarget as HTMLSelectElement).value,
                          ),
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
                    ariaLabel="Review merchant pages"
                    onPageChange={onPageChange}
                  />
                </div>
              </div>
            {/if}
          {/if}
        {:else}
          <Empty.Root class="min-h-64 border">
            <Empty.Header>
              <Empty.Media variant="icon"><Landmark /></Empty.Media>
              <Empty.Title>
                {isPendingView
                  ? "No merchants pending review"
                  : "No reviewed merchants"}
              </Empty.Title>
              <Empty.Description>
                {isPendingView
                  ? "Switch to Reviewed to view merchants already accepted in this ingest."
                  : "Switch to Pending review to view merchants that still need attention."}
              </Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}
      {:else}
        <Empty.Root class="min-h-64 border">
          <Empty.Header>
            <Empty.Media variant="icon"><Landmark /></Empty.Media>
            {#if hasSources}
              <Empty.Title>No merchants to review</Empty.Title>
              <Empty.Description
                >Sync from Accounts, then review merchants here.</Empty.Description
              >
            {:else}
              <Empty.Title>No ingestion sources</Empty.Title>
              <Empty.Description
                >Add a JSON API source under Sources first.</Empty.Description
              >
            {/if}
          </Empty.Header>
          <Empty.Content>
            {#if hasSources}
              <Button type="button" onclick={onOpenAccounts}>
                Open Accounts
                <Link2 class="size-4" aria-hidden="true" />
              </Button>
            {:else}
              <Button type="button" onclick={onOpenSources}>
                Open Sources
                <Link2 class="size-4" aria-hidden="true" />
              </Button>
            {/if}
          </Empty.Content>
        </Empty.Root>
      {/if}
    {/if}
  </div>
</section>

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
