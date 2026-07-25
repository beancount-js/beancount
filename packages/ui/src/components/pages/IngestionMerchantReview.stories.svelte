<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import type { FilterCommandOption } from "../forms/picker-options";
  import IngestionMerchantReview, {
    type MerchantReviewSortKey,
    type MerchantReviewSortOrder,
    type MerchantReviewView,
  } from "./IngestionMerchantReview.svelte";

  const { Story } = defineMeta({
    title: "UI Pages/Ingestion Merchant Review",
    component: IngestionMerchantReview,
    parameters: {
      layout: "fullscreen",
    },
  });

  const statusOptions: FilterCommandOption[] = [
    { value: "confirmed", label: "Confirmed" },
    { value: "suggested", label: "Suggested" },
    { value: "unresolved", label: "Unresolved" },
    { value: "suppressed", label: "Suppressed" },
  ];

  const domainOptions: FilterCommandOption[] = [
    { value: "", label: "Any domain" },
    { value: "has", label: "Has domain" },
    { value: "missing", label: "Missing domain" },
  ];

  const candidate = {
    id: "cand-tesco",
    canonicalName: "Tesco",
    domain: "tesco.com",
    rawScore: 0.94,
    explanation: "Matched recurring card labels and known merchant domain.",
    provenance: [],
    logoUrl:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=96&h=96&q=80",
  };

  const pendingClusters: MerchantReviewCluster[] = [
    {
      id: "cluster-tesco",
      displayName: "Tesco",
      domain: "tesco.com",
      logoUrl: candidate.logoUrl,
      statuses: ["suggested"],
      pendingCount: 12,
      members: [
        {
          rawLabel: "TESCO STORES 3095",
          normalizedLabel: "tesco stores",
          count: 8,
          refs: [{ runId: "run-1", proposalId: "proposal-1" }],
        },
        {
          rawLabel: "TESCO PAY AT PUMP",
          normalizedLabel: "tesco pay at pump",
          count: 4,
          refs: [{ runId: "run-1", proposalId: "proposal-2" }],
        },
      ],
      candidates: [candidate],
      transactions: [
        {
          runId: "run-1",
          proposalId: "proposal-1",
          bookedAt: "2026-07-23",
          amount: "-42.18",
          currency: "GBP",
          payee: "TESCO STORES 3095",
          narration: "Groceries",
          rawLabel: "TESCO STORES 3095",
          sourceAccount: "Assets:Bank:Checking",
          proposalStatus: "pending",
        },
      ],
      primary: { runId: "run-1", proposalId: "proposal-1" },
      primaryCandidate: candidate,
    },
    {
      id: "cluster-unknown",
      displayName: "North Road Coffee",
      statuses: ["unresolved"],
      pendingCount: 3,
      members: [
        {
          rawLabel: "N ROAD COFFEE 01782",
          normalizedLabel: "north road coffee",
          count: 3,
          refs: [{ runId: "run-1", proposalId: "proposal-3" }],
        },
      ],
      candidates: [],
      transactions: [],
      primary: { runId: "run-1", proposalId: "proposal-3" },
    },
  ];

  const reviewedClusters: MerchantReviewCluster[] = [
    {
      id: "cluster-octopus",
      displayName: "Octopus Energy",
      domain: "octopus.energy",
      statuses: ["confirmed"],
      pendingCount: 5,
      members: [
        {
          rawLabel: "OCTOPUS ENERGY DD",
          normalizedLabel: "octopus energy",
          count: 5,
          refs: [{ runId: "run-1", proposalId: "proposal-4" }],
        },
      ],
      candidates: [],
      transactions: [],
      primary: { runId: "run-1", proposalId: "proposal-4" },
    },
  ];
</script>

<script lang="ts">
  let merchantView = $state<MerchantReviewView>("pending");
  let searchQuery = $state("");
  let searchStatuses = $state<string[]>([]);
  let searchDomain = $state("");
  let selectedClusterIds = $state(new Set<string>());
  let sortOrders = $state<Record<MerchantReviewSortKey, MerchantReviewSortOrder>>({
    merchant: "none",
    pending: "none",
  });

  const clusters = $derived(
    merchantView === "pending" ? pendingClusters : reviewedClusters,
  );
  const matchedClusters = $derived(clusters);
  const visibleClusters = $derived(clusters);
  const visibleClusterIds = $derived(visibleClusters.map((cluster) => cluster.id));
  const masterSelection = $derived.by(() => {
    const checked =
      visibleClusterIds.length > 0 &&
      visibleClusterIds.every((id) => selectedClusterIds.has(id));
    const selectedVisibleCount = visibleClusterIds.filter((id) =>
      selectedClusterIds.has(id),
    ).length;
    return {
      checked,
      indeterminate:
        selectedVisibleCount > 0 && selectedVisibleCount < visibleClusterIds.length,
    };
  });
  const summaryLine = $derived(
    `${matchedClusters.length} merchant cluster${matchedClusters.length === 1 ? "" : "s"} · ${matchedClusters.reduce((sum, item) => sum + item.pendingCount, 0)} ${merchantView === "pending" ? "pending" : "reviewed"} transactions`,
  );

  function setSelectedClusters(ids: readonly string[], selected: boolean) {
    const next = new Set(selectedClusterIds);
    for (const id of ids) {
      if (selected) next.add(id);
      else next.delete(id);
    }
    selectedClusterIds = next;
  }

  function cycleSort(key: MerchantReviewSortKey) {
    const order = sortOrders[key];
    sortOrders = {
      ...sortOrders,
      [key]: order === "none" ? "asc" : order === "asc" ? "desc" : "none",
    };
  }
</script>

<Story name="Default">
  {#snippet template()}
    <div class="h-[48rem] bg-background">
      <IngestionMerchantReview
        hasProject={true}
        hasMerchantClusters={true}
        hasSources={true}
        {merchantView}
        pendingCount={pendingClusters.length}
        reviewedCount={reviewedClusters.length}
        {clusters}
        {matchedClusters}
        {visibleClusters}
        {summaryLine}
        {searchQuery}
        {searchStatuses}
        {searchDomain}
        {statusOptions}
        {domainOptions}
        {sortOrders}
        {masterSelection}
        {selectedClusterIds}
        {visibleClusterIds}
        page={1}
        pageCount={1}
        pageSize={25}
        pageSizeOptions={[25, 50, 100]}
        onMerchantViewChange={(view) => {
          merchantView = view;
          selectedClusterIds = new Set();
        }}
        onSearchQueryInput={(value) => {
          searchQuery = value;
        }}
        onClearSearch={() => {
          searchQuery = "";
        }}
        onClearAllSearch={() => {
          searchQuery = "";
          searchStatuses = [];
          searchDomain = "";
        }}
        onSearchStatusesChange={(statuses) => {
          searchStatuses = statuses;
        }}
        onSearchDomainChange={(domain) => {
          searchDomain = domain;
        }}
        onCycleSort={cycleSort}
        onSetSelectedClusters={setSelectedClusters}
        onSelectAllMatching={() => {
          selectedClusterIds = new Set(matchedClusters.map((cluster) => cluster.id));
        }}
        onClearSelected={() => {
          selectedClusterIds = new Set();
        }}
      />
    </div>
  {/snippet}
</Story>
