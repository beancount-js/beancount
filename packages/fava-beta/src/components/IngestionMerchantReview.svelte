<script lang="ts">
  import { onDestroy } from "svelte";
  import type { FilterCommandOption } from "@beancount-js/ui/forms";
  import SharedIngestionMerchantReview, {
    type MerchantReviewSortKey,
    type MerchantReviewSortOrder,
    type MerchantReviewView,
  } from "@beancount-js/ui/pages/IngestionMerchantReview.svelte";
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import {
    checkboxSelectionState,
    pruneReviewSelection,
    updateReviewSelection,
  } from "../lib/review-selection";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import {
    ingestionHeaderActions,
    type IngestionBulkReviewAction,
  } from "../studio/ingestion-header-actions";
  import { debounceWithDelay } from "../hooks/debounce";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { IngestionConfigResponse } from "../ingestion/types";
  import {
    appendIngestionMerchantSearchParams,
    cloneIngestionMerchantSearchState,
    filterIngestionMerchantSearch,
    hasActiveIngestionMerchantSearch,
    merchantClusterConfidence,
    MERCHANT_CLUSTER_STATUS_OPTIONS,
    MERCHANT_DOMAIN_OPTIONS,
    parseIngestionMerchantSearchState,
    type IngestionMerchantSearchState,
    type MerchantDomainFacet,
  } from "../lib/ingestion-merchant-search-state";
  import { merchantReviewFilterSyntax } from "../lib/ingestion-merchant-filter-syntax";
  import IngestionMerchantSheet from "./IngestionMerchantSheet.svelte";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { snapshot } = useStudioWorkspace();
  const { router, activeRoute } = useNavigation();

  const PAGE_SIZES = [25, 50, 100];
  const SORT_CYCLE: Record<MerchantReviewSortOrder, MerchantReviewSortOrder> = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };

  type MerchantReviewResponse = {
    runIds: string[];
    clusters: MerchantReviewCluster[];
    reviewedClusters: MerchantReviewCluster[];
  };

  let config = $state<IngestionConfigResponse | null>(null);
  let pendingClusters = $state<MerchantReviewCluster[]>([]);
  let reviewedClusters = $state<MerchantReviewCluster[]>([]);
  let sourceId = $state("");
  let loading = $state(false);
  let detectBusy = $state(false);
  let confirmBusy = $state(false);
  let status = $state("");
  let sheetOpen = $state(false);
  let selectedCluster = $state<MerchantReviewCluster | null>(null);
  let groupsCollapsedAll = $state(false);
  let loadedProjectId = $state("");
  let sortOrders = $state<
    Record<MerchantReviewSortKey, MerchantReviewSortOrder>
  >({
    merchant: "none",
    pending: "none",
  });
  let sortPriority = $state<MerchantReviewSortKey[]>([]);
  let searchState = $state<IngestionMerchantSearchState>(
    cloneIngestionMerchantSearchState(),
  );
  let lastSearchSignature = $state("");
  let selectedClusterIds = $state(new Set<string>());

  const project = $derived($snapshot);
  const querySourceId = $derived($activeRoute?.query?.sourceId ?? "");
  const queryClusterId = $derived($activeRoute?.query?.cluster ?? "");
  const queryMerchantView = $derived($activeRoute?.query?.merchantView ?? "");
  const merchantView = $derived<MerchantReviewView>(
    queryMerchantView === "pending" || queryMerchantView === "reviewed"
      ? queryMerchantView
      : !pendingClusters.length && reviewedClusters.length
        ? "reviewed"
        : "pending",
  );
  const isPendingView = $derived(merchantView === "pending");
  const clusters = $derived(isPendingView ? pendingClusters : reviewedClusters);
  const hasMerchantClusters = $derived(
    pendingClusters.length > 0 || reviewedClusters.length > 0,
  );
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
  const filterSyntax = $derived(merchantReviewFilterSyntax(clusters));
  const statusOptions = $derived<FilterCommandOption[]>(
    MERCHANT_CLUSTER_STATUS_OPTIONS.map((option) => ({ ...option })),
  );
  const domainOptions = $derived<FilterCommandOption[]>(
    MERCHANT_DOMAIN_OPTIONS.map((option) => ({ ...option })),
  );
  const matchingClusters = $derived(
    new Set(filterIngestionMerchantSearch(clusters, searchState)),
  );
  const matchedClusters = $derived(
    clusters.filter((item) => matchingClusters.has(item)),
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
  const actionableClusterIds = $derived(
    new Set(matchedClusters.map((cluster) => cluster.id)),
  );
  const selectedClusters = $derived(
    matchedClusters.filter((cluster) => selectedClusterIds.has(cluster.id)),
  );
  const confirmableClusters = $derived(
    selectedClusters.filter((cluster) => Boolean(cluster.primaryCandidate)),
  );
  const visibleClusterIds = $derived(
    visibleClusters.map((cluster) => cluster.id),
  );
  const masterSelection = $derived(
    checkboxSelectionState(selectedClusterIds, visibleClusterIds),
  );
  const allMatchingSelected = $derived(
    matchedClusters.length > 0 &&
      selectedClusterIds.size === matchedClusters.length,
  );
  const showSelectionBanner = $derived(
    matchedClusters.length > visibleClusterIds.length &&
      visibleClusterIds.length > 0 &&
      (masterSelection.checked || allMatchingSelected),
  );
  const merchantBulkAction = $derived.by(
    (): IngestionBulkReviewAction | undefined => {
      if (!isPendingView || !selectedClusters.length) return;
      return {
        label: "Detect",
        busyLabel: confirmBusy ? "Confirming merchants" : undefined,
        selectedCount: selectedClusters.length,
        canRun: Boolean(
          isPendingView &&
            project &&
            sourceId &&
            !loading &&
            !detectBusy &&
            !confirmBusy,
        ),
        busy: detectBusy || confirmBusy,
        onRun: () => void detectSelected(),
        additionalActions: [
          {
            label: "Confirm merchants",
            disabled: confirmableClusters.length === 0,
            onRun: () => void confirmSelectedMerchants(),
          },
        ],
      };
    },
  );

  const summaryLine = $derived(
    matchedClusters.length
      ? `${matchedClusters.length} merchant cluster${matchedClusters.length === 1 ? "" : "s"}${activeSearch && matchedClusters.length !== clusters.length ? ` of ${clusters.length}` : ""} · ${matchedClusters.reduce((sum, item) => sum + item.pendingCount, 0)} ${isPendingView ? "pending" : "reviewed"} transactions`
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
        isPendingView && sourceId && clusters.length && !loading && !detectBusy,
      ),
      detectBusy,
      bulkAction: merchantBulkAction,
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

  function setSelectedClusters(
    clusterIds: readonly string[],
    selected: boolean,
  ) {
    selectedClusterIds = updateReviewSelection(
      selectedClusterIds,
      clusterIds,
      selected,
    );
  }

  function selectAllMatchingClusters() {
    selectedClusterIds = new Set(matchedClusters.map((cluster) => cluster.id));
  }

  function clearSelectedClusters() {
    selectedClusterIds = new Set();
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

  $effect(() => {
    const next = pruneReviewSelection(selectedClusterIds, actionableClusterIds);
    if (
      next.size !== selectedClusterIds.size ||
      [...next].some((id) => !selectedClusterIds.has(id))
    ) {
      selectedClusterIds = next;
    }
  });

  function openCluster(cluster: MerchantReviewCluster) {
    if (queryClusterId === cluster.id && sheetOpen) return;
    updateRoute({ cluster: cluster.id });
  }

  function closeClusterSheet() {
    if (queryClusterId) updateRoute({ cluster: undefined });
  }

  function cycleSort(key: MerchantReviewSortKey) {
    const next = SORT_CYCLE[sortOrders[key]];
    sortOrders = { ...sortOrders, [key]: next };
    if (next === "none") {
      sortPriority = sortPriority.filter((item) => item !== key);
    } else if (!sortPriority.includes(key)) {
      sortPriority = [...sortPriority, key];
    }
    if (requestedPage !== 1) updateRoute({ page: "1" });
  }

  function setMerchantView(value: MerchantReviewView) {
    updateRoute({ merchantView: value, page: "1", cluster: undefined });
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

  function openAccounts() {
    router.push("/import/accounts");
  }

  function openSources() {
    router.push("/import/editor");
  }

  async function refreshClusters() {
    if (!project || !sourceId) {
      pendingClusters = [];
      reviewedClusters = [];
      return;
    }
    const response = await ingestionJson<MerchantReviewResponse>(
      ingestionPath(
        project.project.id,
        `/merchant-review?sourceId=${encodeURIComponent(sourceId)}`,
      ),
    );
    pendingClusters = response.clusters;
    reviewedClusters = response.reviewedClusters;
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

  async function detectClusters(clusterIds?: readonly string[]) {
    if (!isPendingView || !project || !clusters.length) return;
    detectBusy = true;
    status = "Detecting merchants...";
    try {
      const result = await ingestionJson<{ clusters: number; calls: number }>(
        ingestionPath(project.project.id, "/merchant-review/detect"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId, clusterIds }),
        },
      );
      await refreshClusters();
      selectedClusterIds = new Set();
      status = `Merchant detection finished for ${result.clusters} cluster${result.clusters === 1 ? "" : "s"} in ${result.calls} AI call${result.calls === 1 ? "" : "s"}.`;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      detectBusy = false;
    }
  }

  function detectAll() {
    void detectClusters();
  }

  function detectSelected() {
    void detectClusters(selectedClusters.map((cluster) => cluster.id));
  }

  async function confirmSelectedMerchants() {
    if (!project || confirmBusy || !confirmableClusters.length) return;
    const clustersToConfirm = [...confirmableClusters];
    confirmBusy = true;
    status = `Confirming ${clustersToConfirm.length} merchant${clustersToConfirm.length === 1 ? "" : "s"}...`;
    let confirmedCount = 0;
    try {
      for (const cluster of clustersToConfirm) {
        const candidate = cluster.primaryCandidate;
        if (!candidate) continue;
        await ingestionJson(
          ingestionPath(
            project.project.id,
            `/runs/${encodeURIComponent(cluster.primary.runId)}/proposals/${encodeURIComponent(cluster.primary.proposalId)}/merchant`,
          ),
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "confirm",
              candidateId: candidate.id,
              normalizedLabels: cluster.members.map(
                (member) => member.normalizedLabel,
              ),
            }),
          },
        );
        confirmedCount += 1;
      }
      await refreshClusters();
      selectedClusterIds = new Set();
      status = `Confirmed ${confirmedCount} merchant${confirmedCount === 1 ? "" : "s"}.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status = confirmedCount
        ? `Confirmed ${confirmedCount} merchant${confirmedCount === 1 ? "" : "s"}; ${message}`
        : message;
    } finally {
      confirmBusy = false;
    }
  }
</script>

<SharedIngestionMerchantReview
  {isWeb}
  hasProject={Boolean(project)}
  {loading}
  {status}
  {hasMerchantClusters}
  hasSources={Boolean(config?.sources.length)}
  {merchantView}
  pendingCount={pendingClusters.length}
  reviewedCount={reviewedClusters.length}
  {clusters}
  {matchedClusters}
  {visibleClusters}
  {summaryLine}
  {activeSearch}
  searchQuery={searchState.query}
  searchStatuses={searchState.statuses}
  searchDomain={searchState.domain}
  {statusOptions}
  {domainOptions}
  {filterSyntax}
  {sortOrders}
  {masterSelection}
  {selectedClusterIds}
  {visibleClusterIds}
  {allMatchingSelected}
  {showSelectionBanner}
  {detectBusy}
  {page}
  pageCount={pages.length}
  {pageSize}
  pageSizeOptions={PAGE_SIZES}
  onMerchantViewChange={setMerchantView}
  onSearchQueryInput={onSearchQueryInput}
  onClearSearch={clearSearchQuery}
  onClearAllSearch={clearAllSearch}
  onSearchStatusesChange={(statuses) => setSearchFacet("statuses", statuses)}
  onSearchDomainChange={(domain) =>
    setSearchFacet("domain", domain as MerchantDomainFacet)}
  onCycleSort={cycleSort}
  onSetSelectedClusters={setSelectedClusters}
  onSelectAllMatching={selectAllMatchingClusters}
  onClearSelected={clearSelectedClusters}
  onOpenCluster={openCluster}
  onPageChange={(nextPage) => updateRoute({ page: String(nextPage) })}
  onPageSizeChange={(nextSize) =>
    updateRoute({ pageSize: String(nextSize), page: "1" })}
  onOpenAccounts={openAccounts}
  onOpenSources={openSources}
/>

{#if selectedCluster && project}
  {#key selectedCluster.id}
    <IngestionMerchantSheet
      bind:open={sheetOpen}
      projectId={project.project.id}
      {sourceId}
      cluster={selectedCluster}
      readOnly={!isPendingView}
      onClosed={closeClusterSheet}
      onUpdated={() => void refreshClusters()}
      onStatus={(message) => (status = message)}
    />
  {/key}
{/if}
