<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import IngestionRunAudit, {
    type IngestionRunAuditAiCall,
    type IngestionRunAuditDateGroup,
  } from "./IngestionRunAudit.svelte";

  const { Story } = defineMeta({
    title: "UI Pages/Ingestion Run Audit",
    component: IngestionRunAudit,
    parameters: {
      layout: "fullscreen",
    },
  });

  const aiCalls: IngestionRunAuditAiCall[] = [
    {
      id: "call-1",
      at: "25 Jul 2026, 09:12 UTC",
      label: "Merchant enrichment",
      ok: true,
      batchSize: 12,
      durationMs: 1840,
      prompt: "Classify merchant labels for recurring grocery transactions.",
      response: "Matched Tesco with high confidence.",
    },
    {
      id: "call-2",
      at: "25 Jul 2026, 09:14 UTC",
      label: "Category suggestion",
      ok: false,
      batchSize: 3,
      durationMs: 720,
      error: "Provider quota exceeded.",
    },
  ];

  const dateGroups: IngestionRunAuditDateGroup[] = [
    {
      key: "2026-07-24",
      label: "JULY 24, 2026",
      rows: [
        {
          key: "run-1:proposal-1",
          proposalId: "proposal-1",
          title: "Tesco",
          detail: "ready · Expenses:Groceries",
          amount: "-42.18 GBP",
          initial: "T",
          logoUrl:
            "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=96&h=96&q=80",
        },
        {
          key: "run-1:proposal-2",
          proposalId: "proposal-2",
          title: "Octopus Energy",
          detail: "accepted · Expenses:Utilities · accepted into main.beancount",
          amount: "-86.40 GBP",
          initial: "O",
        },
      ],
    },
    {
      key: "2026-07-23",
      label: "JULY 23, 2026",
      rows: [
        {
          key: "run-1:proposal-3",
          proposalId: "proposal-3",
          title: "North Road Coffee",
          detail: "needs_review · Uncategorized · AI error",
          amount: "-3.80 GBP",
          initial: "N",
        },
      ],
    },
  ];
</script>

<script lang="ts">
  let expandedGroupKeys = $state(new Set(dateGroups.map((group) => group.key)));
  let selectedStatus = $state("");

  const groupsCollapsedAll = $derived(
    dateGroups.every((group) => !expandedGroupKeys.has(group.key)),
  );

  function toggleGroup(groupKey: string) {
    const next = new Set(expandedGroupKeys);
    if (next.has(groupKey)) next.delete(groupKey);
    else next.add(groupKey);
    expandedGroupKeys = next;
  }
</script>

<Story name="Default">
  {#snippet template()}
    <div class="h-[48rem] bg-background">
      {#if selectedStatus}
        <p class="px-5 pt-4 text-sm text-muted-foreground" role="status">
          {selectedStatus}
        </p>
      {/if}
      <IngestionRunAudit
        hasProject={true}
        hasRun={true}
        runId="run-2026-07-25"
        sourceId="starling"
        completedAtLabel="25 Jul 2026, 09:16 UTC"
        totalProposals={3}
        summaryLine="1 ready · 1 need review · 1 accepted · 0 duplicates"
        {aiCalls}
        {dateGroups}
        visibleGroups={dateGroups}
        {expandedGroupKeys}
        {groupsCollapsedAll}
        page={1}
        pageCount={1}
        pageSize={50}
        pageSizeOptions={[25, 50, 100]}
        onBackToHistory={() => {
          selectedStatus = "Back to import history.";
        }}
        onToggleAllGroups={() => {
          expandedGroupKeys = groupsCollapsedAll
            ? new Set(dateGroups.map((group) => group.key))
            : new Set();
        }}
        onToggleGroup={toggleGroup}
        onOpenRow={(rowKey) => {
          selectedStatus = `Open ${rowKey}.`;
        }}
      />
    </div>
  {/snippet}
</Story>
