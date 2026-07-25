<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import IngestionReconciliationPanel, {
    type ReconciliationPanelItem,
    type ReconciliationReviewFacetOptions,
    type ReconciliationReviewSearchValues,
  } from "./IngestionReconciliationPanel.svelte";

  const { Story } = defineMeta({
    title: "UI Pages/Ingestion Reconciliation Panel",
    component: IngestionReconciliationPanel,
    parameters: {
      layout: "fullscreen",
    },
  });

  const baseSearchValues: ReconciliationReviewSearchValues = {
    query: "",
    accounts: [],
    sources: [],
    years: [],
    currencies: [],
    kinds: [],
    confidence: [],
  };

  const facetOptions: ReconciliationReviewFacetOptions = {
    accounts: [
      { value: "Assets:Bank:Checking", label: "Assets:Bank:Checking" },
      { value: "Expenses:Groceries", label: "Expenses:Groceries" },
    ],
    sources: [
      { value: "Ledger", label: "Ledger" },
      { value: "Starling", label: "Starling" },
    ],
    years: [{ value: "2026", label: "2026" }],
    currencies: [{ value: "GBP", label: "GBP" }],
    kinds: [
      { value: "existing", label: "Already In Ledger" },
      { value: "transfer", label: "Account Transfer" },
    ],
    confidence: [
      { value: "high", label: "High" },
      { value: "possible", label: "Possible" },
    ],
  };

  const items: ReconciliationPanelItem[] = [
    {
      id: "candidate-existing",
      kind: "existing",
      kindLabel: "Already In Ledger",
      confidence: "high",
      confidenceLabel: "High",
      confidenceVariant: "success",
      evidenceSummary: "Same account, amount, and booking date as an existing ledger entry.",
      chosenObservationId: "ledger-1",
      selectable: true,
      members: [
        {
          observationId: "incoming-1",
          label: "Tesco Stores 3095",
          detail: "Assets:Bank:Checking · 2026-07-23",
          account: "Assets:Bank:Checking",
          color: "#2563eb",
          icon: "landmark",
          sourceLabel: "Starling",
          sourceMerchantId: "tesco",
          sourceMerchantLogoUrl:
            "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=96&h=96&q=80",
          amount: "-42.18",
          currency: "GBP",
        },
        {
          observationId: "ledger-1",
          label: "Groceries",
          detail: "Expenses:Groceries · 2026-07-23",
          account: "Expenses:Groceries",
          color: "#b45309",
          icon: "shopping-cart",
          sourceLabel: "Ledger",
          amount: "42.18",
          currency: "GBP",
        },
      ],
    },
    {
      id: "candidate-transfer",
      kind: "transfer",
      kindLabel: "Account Transfer",
      confidence: "possible",
      confidenceLabel: "Possible",
      confidenceVariant: "warning",
      evidenceSummary: "Opposite signed amounts landed within the transfer window.",
      selectable: false,
      selectableTitle: "Choose a canonical record before confirming this match",
      members: [
        {
          observationId: "incoming-2",
          label: "Internal transfer",
          detail: "Assets:Bank:Checking · 2026-07-22",
          account: "Assets:Bank:Checking",
          color: "#2563eb",
          icon: "landmark",
          sourceLabel: "Starling",
          amount: "-250.00",
          currency: "GBP",
        },
      ],
    },
  ];
</script>

<script lang="ts">
  let searchValues = $state<ReconciliationReviewSearchValues>({
    ...baseSearchValues,
  });
  let selectedCandidateIds = $state(new Set<string>());
  let status = $state("");

  const visibleActionableIds = $derived(
    items.filter((item) => item.selectable).map((item) => item.id),
  );
  const masterSelection = $derived.by(() => {
    const selectedVisible = visibleActionableIds.filter((id) =>
      selectedCandidateIds.has(id),
    );
    return {
      checked:
        visibleActionableIds.length > 0 &&
        selectedVisible.length === visibleActionableIds.length,
      indeterminate:
        selectedVisible.length > 0 &&
        selectedVisible.length < visibleActionableIds.length,
    };
  });

  function setSelected(ids: readonly string[], selected: boolean) {
    const next = new Set(selectedCandidateIds);
    for (const id of ids) {
      if (selected) next.add(id);
      else next.delete(id);
    }
    selectedCandidateIds = next;
  }
</script>

<Story name="Default">
  {#snippet template()}
    <div class="h-[48rem] bg-background p-5">
      {#if status}
        <p class="mb-3 text-sm text-muted-foreground" role="status">{status}</p>
      {/if}
      <IngestionReconciliationPanel
        reviewLoaded={true}
        hasCandidates={true}
        matchedItemCount={items.length}
        visibleItems={items}
        actionableItemCount={visibleActionableIds.length}
        {visibleActionableIds}
        {selectedCandidateIds}
        {masterSelection}
        {searchValues}
        {facetOptions}
        page={1}
        pageCount={1}
        pageSize={10}
        pageSizeOptions={[10, 25, 50, 100]}
        onSearchQueryInput={(query) => {
          searchValues = { ...searchValues, query };
        }}
        onClearSearch={() => {
          searchValues = { ...searchValues, query: "" };
        }}
        onClearAllSearch={() => {
          searchValues = { ...baseSearchValues };
        }}
        onFacetChange={(key, value) => {
          searchValues = { ...searchValues, [key]: value };
        }}
        onSetSelectedCandidates={setSelected}
        onSelectAllMatching={() => {
          selectedCandidateIds = new Set(visibleActionableIds);
        }}
        onClearSelected={() => {
          selectedCandidateIds = new Set();
        }}
        onAutoConfirm={() => {
          status = "Auto-confirm queued.";
        }}
        onApply={(id) => {
          status = `Apply ${id}.`;
        }}
        onDismiss={(id) => {
          status = `Dismiss ${id}.`;
        }}
        onConfirm={(id) => {
          status = `Confirm ${id}.`;
        }}
      />
    </div>
  {/snippet}
</Story>
