<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import IngestionRunHistory, {
    type IngestionRunHistoryGroup,
    type IngestionRunHistorySortKey,
    type IngestionRunHistorySortOrder,
  } from "./IngestionRunHistory.svelte";

  const { Story } = defineMeta({
    title: "UI Pages/Ingestion Run History",
    component: IngestionRunHistory,
    parameters: {
      layout: "fullscreen",
    },
  });

  const groups: IngestionRunHistoryGroup[] = [
    {
      key: "2026-07-25",
      label: "JULY 25, 2026",
      runs: [
        {
          id: "run-1",
          href: "/import/history/run-1",
          sourceTitle: "Starling Checking",
          sourceName: "Starling",
          sourceAccount: "Assets:Bank:Checking",
          sourceAccountHref: "/account/Assets:Bank:Checking",
          sourceAccountColor: "#2563eb",
          sourceAccountIcon: "landmark",
          sourceMerchantId: "starling",
          sourceMerchantLogoUrl:
            "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=96&h=96&q=80",
          reviewState: "pending",
          completedAtLabel: "09:18 UTC",
          total: 34,
          accepted: 21,
          needsReview: 9,
          duplicates: 4,
        },
        {
          id: "run-2",
          href: "/import/history/run-2",
          sourceTitle: "Octopus Energy",
          sourceName: "Octopus",
          sourceAccount: "Expenses:Utilities",
          sourceAccountHref: "/account/Expenses:Utilities",
          sourceAccountColor: "#16a34a",
          sourceAccountIcon: "zap",
          reviewState: "completed",
          completedAtLabel: "08:05 UTC",
          total: 5,
          accepted: 5,
          needsReview: 0,
          duplicates: 0,
        },
      ],
    },
    {
      key: "2026-07-24",
      label: "JULY 24, 2026",
      runs: [
        {
          id: "run-3",
          href: "/import/history/run-3",
          sourceTitle: "Manual CSV Upload",
          sourceName: "CSV",
          reviewState: "completed",
          completedAtLabel: "17:42 UTC",
          total: 18,
          accepted: 13,
          needsReview: 0,
          duplicates: 5,
        },
      ],
    },
  ];
</script>

<script lang="ts">
  let sortOrders = $state<Record<IngestionRunHistorySortKey, IngestionRunHistorySortOrder>>({
    date: "none",
    proposals: "none",
    accepted: "none",
    review: "none",
    duplicates: "none",
  });
  let status = $state("");

  function cycleSort(key: IngestionRunHistorySortKey) {
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
      {#if status}
        <p class="px-5 pt-4 text-sm text-muted-foreground" role="status">{status}</p>
      {/if}
      <IngestionRunHistory
        hasProject={true}
        {groups}
        {sortOrders}
        page={1}
        pageCount={1}
        pageSize={25}
        pageSizeOptions={[25, 50, 100]}
        onCycleSort={cycleSort}
        onRunLinkClick={(event, runId) => {
          event.preventDefault();
          status = `Open ${runId}.`;
        }}
      />
    </div>
  {/snippet}
</Story>
