<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    FilterCommandPicker,
    SearchFilterBar,
    type FilterCommandOption,
  } from "@beancount-js/forms";
  import ArrowDownWideNarrow from "lucide-svelte/icons/arrow-down-wide-narrow";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import ArrowUpNarrowWide from "lucide-svelte/icons/arrow-up-narrow-wide";
  import ChevronsLeft from "lucide-svelte/icons/chevrons-left";
  import ChevronsRight from "lucide-svelte/icons/chevrons-right";
  import Landmark from "lucide-svelte/icons/landmark";
  import Link2 from "lucide-svelte/icons/link-2";
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import type { SortOrder } from "../grid/sort";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { debounceWithDelay } from "../hooks/debounce";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { IngestionConfigResponse } from "../ingestion/types";
  import {
    appendIngestionMerchantSearchParams,
    cloneIngestionMerchantSearchState,
    hasActiveIngestionMerchantSearch,
    matchesIngestionMerchantSearch,
    MERCHANT_CLUSTER_STATUS_OPTIONS,
    MERCHANT_DOMAIN_OPTIONS,
    parseIngestionMerchantSearchState,
    type IngestionMerchantSearchState,
    type MerchantDomainFacet,
  } from "../lib/ingestion-merchant-search-state";
  import IngestionMerchantSheet from "./IngestionMerchantSheet.svelte";
  import MerchantsPageSkeleton from "./skeletons/MerchantsPageSkeleton.svelte";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { snapshot } = useStudioWorkspace();
  const { router, activeRoute } = useNavigation();

  const PAGE_SIZES = [25, 50, 100];
  const SORT_CYCLE: Record<SortOrder, SortOrder> = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };

  type MerchantReviewResponse = {
    runIds: string[];
    clusters: MerchantReviewCluster[];
  };
  type SortKey = "merchant" | "pending";

  let config = $state<IngestionConfigResponse | null>(null);
  let clusters = $state<MerchantReviewCluster[]>([]);
  let sourceId = $state("");
  let loading = $state(false);
  let detectBusy = $state(false);
  let status = $state("");
  let sheetOpen = $state(false);
  let selectedCluster = $state<MerchantReviewCluster | null>(null);
  let groupsCollapsedAll = $state(false);
  let loadedProjectId = $state("");
  let failedLogoIds = $state(new Set<string>());
  let sortOrders = $state<Record<SortKey, SortOrder>>({
    merchant: "none",
    pending: "none",
  });
  /** Order sorts were added; earlier entries are primary. */
  let sortPriority = $state<SortKey[]>([]);
  let filtersExpanded = $state(false);
  let searchState = $state<IngestionMerchantSearchState>(
    cloneIngestionMerchantSearchState(),
  );
  let lastSearchSignature = $state("");

  const project = $derived($snapshot);
  const querySourceId = $derived($activeRoute?.query?.sourceId ?? "");
  const queryClusterId = $derived($activeRoute?.query?.cluster ?? "");
  const sourceOptions = $derived(
    (config?.sources ?? []).map((source) => ({
      value: source.id,
      label: `${source.name}${source.credentialAvailable ? "" : " (credential unavailable)"}`,
    })),
  );

  const pageSize = $derived(
    PAGE_SIZES.includes(Number($activeRoute?.query?.pageSize))
      ? Number($activeRoute.query.pageSize)
      : 50,
  );
  const activeSearch = $derived(hasActiveIngestionMerchantSearch(searchState));
  const statusOptions = $derived<FilterCommandOption[]>(
    MERCHANT_CLUSTER_STATUS_OPTIONS.map((option) => ({ ...option })),
  );
  const domainOptions = $derived<FilterCommandOption[]>(
    MERCHANT_DOMAIN_OPTIONS.map((option) => ({ ...option })),
  );
  const matchedClusters = $derived(
    clusters.filter((item) =>
      matchesIngestionMerchantSearch(item, searchState),
    ),
  );
  const sortedClusters = $derived.by(() => {
    const keys = sortPriority.filter((key) => sortOrders[key] !== "none");
    if (!keys.length) return matchedClusters;
    const next = [...matchedClusters];
    next.sort((left, right) => {
      for (const key of keys) {
        const direction = sortOrders[key] === "asc" ? 1 : -1;
        const cmp =
          key === "merchant"
            ? left.displayName.localeCompare(right.displayName, undefined, {
                sensitivity: "base",
              })
            : left.pendingCount - right.pendingCount;
        if (cmp !== 0) return direction * cmp;
      }
      return 0;
    });
    return next;
  });
  const pages = $derived(paginateClusters(sortedClusters, pageSize));
  const requestedPage = $derived(
    Math.max(1, Number($activeRoute?.query?.page) || 1),
  );
  const page = $derived(Math.min(requestedPage, Math.max(1, pages.length)));
  const visibleClusters = $derived(pages[page - 1] ?? []);

  const summaryLine = $derived(
    matchedClusters.length
      ? `${matchedClusters.length} merchant cluster${matchedClusters.length === 1 ? "" : "s"}${activeSearch && matchedClusters.length !== clusters.length ? ` of ${clusters.length}` : ""} · ${matchedClusters.reduce((sum, item) => sum + item.pendingCount, 0)} pending transactions`
      : "",
  );

  $effect(() => {
    if (isWeb || !project) {
      ingestionHeaderActions.set(null);
      return;
    }
    ingestionHeaderActions.set({
      kind: "merchants",
      sourceId,
      sourceOptions,
      groupsCollapsedAll,
      canDetect: Boolean(
        sourceId && clusters.length && !loading && !detectBusy,
      ),
      detectBusy,
      onSourceChange: (next) => void loadForSource(next),
      onToggleCollapseGroups: () => {
        groupsCollapsedAll = !groupsCollapsedAll;
      },
      onDetectMerchants: () => void detectAll(),
      onReviewImports: () => router.push("/records"),
      onOpenAccounts: () => router.push("/import/accounts"),
      onEditSources: () => router.push("/import/editor"),
    });
  });

  onDestroy(() => {
    ingestionHeaderActions.set(null);
  });

  $effect(() => {
    const projectId = project?.project.id;
    if (!projectId || isWeb) return;
    if (loadedProjectId === projectId && config) return;
    void refresh();
  });

  function paginateClusters(
    items: readonly MerchantReviewCluster[],
    size: number,
  ): MerchantReviewCluster[][] {
    if (!items.length) return [];
    const result: MerchantReviewCluster[][] = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  function updateRoute(values: Record<string, string | undefined>) {
    const query = new URLSearchParams($activeRoute.query);
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const next = query.toString();
    router.updateState(next ? `?${next}` : "?");
  }

  function searchSignature(query: Record<string, string>) {
    const params = new URLSearchParams(query);
    return [
      params.get("merchantQ") ?? "",
      params.get("merchantStatus") ?? "",
      params.get("merchantDomain") ?? "",
    ].join("\0");
  }

  function applySearchState(
    next: IngestionMerchantSearchState,
    resetPage = true,
  ) {
    searchState = cloneIngestionMerchantSearchState(next);
    const params = new URLSearchParams($activeRoute.query);
    appendIngestionMerchantSearchParams(params, next);
    if (resetPage) params.set("page", "1");
    lastSearchSignature = searchSignature(Object.fromEntries(params));
    const search = params.toString();
    router.updateState(search ? `?${search}` : "?");
  }

  const [scheduleSearchSync, delaySearchSync] = debounceWithDelay(
    (next: IngestionMerchantSearchState) => {
      applySearchState(next);
    },
    250,
  );

  function onSearchQueryInput(value: string) {
    searchState = { ...searchState, query: value };
    scheduleSearchSync(searchState);
    delaySearchSync();
  }

  function setSearchFacet<K extends keyof IngestionMerchantSearchState>(
    key: K,
    value: IngestionMerchantSearchState[K],
  ) {
    applySearchState({ ...searchState, [key]: value });
  }

  function clearSearchQuery() {
    applySearchState({ ...searchState, query: "" });
  }

  function clearAllSearch() {
    applySearchState(cloneIngestionMerchantSearchState());
  }

  $effect(() => {
    const signature = searchSignature($activeRoute.query);
    if (signature === lastSearchSignature) return;
    lastSearchSignature = signature;
    searchState = parseIngestionMerchantSearchState($activeRoute.query);
  });

  function openCluster(cluster: MerchantReviewCluster) {
    if (queryClusterId === cluster.id && sheetOpen) return;
    updateRoute({ cluster: cluster.id });
  }

  function closeClusterSheet() {
    if (queryClusterId) updateRoute({ cluster: undefined });
  }

  function cycleSort(key: SortKey) {
    const next = SORT_CYCLE[sortOrders[key]];
    sortOrders = { ...sortOrders, [key]: next };
    if (next === "none") {
      sortPriority = sortPriority.filter((item) => item !== key);
    } else if (!sortPriority.includes(key)) {
      sortPriority = [...sortPriority, key];
    }
    if (requestedPage !== 1) updateRoute({ page: "1" });
  }

  function ariaSortFor(key: SortKey): "ascending" | "descending" | "none" {
    const order = sortOrders[key];
    if (order === "none") return "none";
    return order === "asc" ? "ascending" : "descending";
  }

  $effect(() => {
    if (!clusters.length) return;
    if (!queryClusterId) {
      selectedCluster = null;
      sheetOpen = false;
      return;
    }
    const found = clusters.find((item) => item.id === queryClusterId) ?? null;
    selectedCluster = found;
    sheetOpen = Boolean(found);
    if (!found) updateRoute({ cluster: undefined });
  });

  function handleRowKeydown(
    event: KeyboardEvent,
    cluster: MerchantReviewCluster,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCluster(cluster);
    }
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

  function markLogoFailed(clusterId: string) {
    failedLogoIds = new Set([...failedLogoIds, clusterId]);
  }

  function openAccounts() {
    router.push("/import/accounts");
  }

  function openSources() {
    router.push("/import/editor");
  }

  async function refreshClusters() {
    if (!project || !sourceId) {
      clusters = [];
      return;
    }
    const response = await ingestionJson<MerchantReviewResponse>(
      ingestionPath(
        project.project.id,
        `/merchant-review?sourceId=${encodeURIComponent(sourceId)}`,
      ),
    );
    clusters = response.clusters;
    const nextPages = paginateClusters(clusters, pageSize);
    if (
      requestedPage > 1 &&
      nextPages.length &&
      requestedPage > nextPages.length
    ) {
      updateRoute({ page: String(nextPages.length) });
    }
  }

  async function refresh() {
    if (!project || isWeb) return;
    loading = true;
    try {
      const configResponse = await ingestionJson<IngestionConfigResponse>(
        ingestionPath(project.project.id),
      );
      config = configResponse;
      const preferred =
        querySourceId &&
        config.sources.some((source) => source.id === querySourceId)
          ? querySourceId
          : sourceId;
      sourceId = config.sources.some((source) => source.id === preferred)
        ? preferred
        : (config.sources[0]?.id ?? "");
      loadedProjectId = project.project.id;
      await refreshClusters();
      status = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function loadForSource(nextSourceId: string) {
    sourceId = nextSourceId;
    loading = true;
    updateRoute({ page: "1", sourceId: nextSourceId, cluster: undefined });
    try {
      await refreshClusters();
      status = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function detectAll() {
    if (!project || !clusters.length) return;
    detectBusy = true;
    status = "Detecting merchants…";
    try {
      for (const cluster of clusters) {
        await ingestionJson(
          ingestionPath(
            project.project.id,
            `/runs/${encodeURIComponent(cluster.primary.runId)}/proposals/${encodeURIComponent(cluster.primary.proposalId)}/enrich`,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              merchantOnly: true,
              normalizedLabels: cluster.members.map(
                (member) => member.normalizedLabel,
              ),
            }),
          },
        );
      }
      await refreshClusters();
      status = "Merchant detection finished.";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      detectBusy = false;
    }
  }
</script>

<div class="h-full overflow-auto p-3 sm:p-5" data-ingestion-merchant-review>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if isWeb}
      <div
        class="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
      >
        Merchant review is available only when this project is opened through
        the local Beancount Studio server.
      </div>
    {:else if !project}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Open a project to review merchants.
      </div>
    {/if}

    {#if status}
      <p class="text-sm text-muted-foreground" role="status">{status}</p>
    {/if}

    {#if !isWeb && project}
      {#if loading && !clusters.length}
        <MerchantsPageSkeleton />
      {:else if clusters.length}
        {#if summaryLine}
          <p class="text-sm text-muted-foreground">{summaryLine}</p>
        {/if}

        <div
          class="ingestion-page-search"
          style="--cv-search-filter-justify: stretch; --cv-search-filter-content-justify: stretch; --cv-search-filter-max-width: 100%;"
        >
          <SearchFilterBar
            inputMode="plain"
            value={searchState.query}
            placeholder="Search merchants…"
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
            onValueChange={onSearchQueryInput}
            onClearSearch={clearSearchQuery}
            onClearAll={clearAllSearch}
          >
            {#snippet filters()}
              <div class="ingestion-page-search__facet-row">
                <FilterCommandPicker
                  multiple
                  label="Status"
                  values={searchState.statuses}
                  options={statusOptions}
                  placeholder="Filter by status…"
                  onValuesChange={(statuses) =>
                    setSearchFacet("statuses", statuses)}
                />
                <FilterCommandPicker
                  label="Domain"
                  value={searchState.domain}
                  options={domainOptions}
                  placeholder="Filter by domain…"
                  onChange={(domain) =>
                    setSearchFacet("domain", domain as MerchantDomainFacet)}
                />
              </div>
            {/snippet}
            {#snippet collapsedFilters()}
              <div class="ingestion-page-search__facet-row">
                {#if searchState.statuses.length > 0}
                  <FilterCommandPicker
                    multiple
                    label="Status"
                    values={searchState.statuses}
                    options={statusOptions}
                    onValuesChange={(statuses) =>
                      setSearchFacet("statuses", statuses)}
                  />
                {/if}
                {#if searchState.domain}
                  <FilterCommandPicker
                    label="Domain"
                    value={searchState.domain}
                    options={domainOptions}
                    onChange={(domain) =>
                      setSearchFacet("domain", domain as MerchantDomainFacet)}
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
            role="row"
            class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <div
              role="columnheader"
              aria-sort={ariaSortFor("merchant")}
              class="justify-self-start"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Sort by merchant"
                onclick={() => cycleSort("merchant")}
              >
                Merchant
                {#if sortOrders.merchant === "asc"}
                  <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
                {:else if sortOrders.merchant === "desc"}
                  <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
                {:else}
                  <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
                {/if}
              </button>
            </div>
            <div
              role="columnheader"
              aria-sort={ariaSortFor("pending")}
              class="justify-self-end"
            >
              <button
                type="button"
                class="inline-flex items-center justify-end gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Sort by pending count"
                onclick={() => cycleSort("pending")}
              >
                Pending
                {#if sortOrders.pending === "asc"}
                  <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
                {:else if sortOrders.pending === "desc"}
                  <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
                {:else}
                  <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
                {/if}
              </button>
            </div>
          </div>
          <div class="mx-1 overflow-hidden rounded-xl border bg-card shadow-sm">
            {#each visibleClusters as cluster, index (cluster.id)}
              <div
                role="button"
                tabindex="0"
                class:rounded-b-xl={index === visibleClusters.length - 1}
                class="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-[15px] py-4 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Review merchant ${cluster.displayName}`}
                onclick={() => openCluster(cluster)}
                onkeydown={(event) => handleRowKeydown(event, cluster)}
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
                  <div class="mt-1 truncate text-xs text-muted-foreground">
                    <span class="capitalize"
                      >{cluster.statuses[0] ?? "unresolved"}</span
                    >
                    · {clusterDetail(cluster)}
                  </div>
                </div>
                <span class="text-sm font-semibold tabular-nums">
                  {cluster.pendingCount}
                </span>
              </div>
            {/each}
          </div>

          {#if pages.length > 1}
            <nav
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
              aria-label="Review merchant pages"
            >
              <span class="text-sm text-muted-foreground"
                >Page {page} of {pages.length}</span
              >
              <div class="flex items-center gap-2">
                <label
                  class="text-sm text-muted-foreground"
                  for="ingestion-merchant-page-size">Records per page</label
                >
                <select
                  id="ingestion-merchant-page-size"
                  class="h-8 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onchange={(event) =>
                    updateRoute({
                      pageSize: (event.currentTarget as HTMLSelectElement)
                        .value,
                      page: "1",
                    })}
                >
                  {#each PAGE_SIZES as size (size)}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Previous merchant page"
                  disabled={page <= 1}
                  onclick={() => updateRoute({ page: String(page - 1) })}
                >
                  <ChevronsLeft />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Next merchant page"
                  disabled={page >= pages.length}
                  onclick={() => updateRoute({ page: String(page + 1) })}
                >
                  <ChevronsRight />
                </Button>
              </div>
            </nav>
          {/if}
        {/if}
      {:else}
        <Empty.Root class="min-h-64 border">
          <Empty.Header>
            <Empty.Media variant="icon"><Landmark /></Empty.Media>
            {#if config?.sources.length}
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
            {#if config?.sources.length}
              <Button type="button" onclick={openAccounts}>
                Open Accounts
                <Link2 class="size-4" aria-hidden="true" />
              </Button>
            {:else}
              <Button type="button" onclick={openSources}>
                Open Sources
                <Link2 class="size-4" aria-hidden="true" />
              </Button>
            {/if}
          </Empty.Content>
        </Empty.Root>
      {/if}
    {/if}
  </div>
</div>

{#if selectedCluster && project}
  {#key selectedCluster.id}
    <IngestionMerchantSheet
      bind:open={sheetOpen}
      projectId={project.project.id}
      {sourceId}
      cluster={selectedCluster}
      onClosed={closeClusterSheet}
      onUpdated={() => void refreshClusters()}
      onStatus={(message) => (status = message)}
    />
  {/key}
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
