<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import IngestionTable from "./IngestionTable.svelte";

  const { Story } = defineMeta({
    title: "Tables/Ingestion Table",
    component: IngestionTable,
    parameters: {
      docs: {
        description: {
          component:
            "A migration-facing adapter for ingest-review rows and queues. The application layer continues owning search, pagination, and all API mutations; this component handles grouped row presentation, queue filtering, and selection.",
        },
      },
    },
  });

  const reviewGroups = [
    {
      id: "2026-07-18",
      label: "July 18, 2026",
      rows: [
        {
          id: "northstar-cafe",
          title: "Northstar Cafe",
          detail: "Lunch near the office",
          status: "needs-review",
          statusLabel: "Needs review",
          postings: [
            { account: "Liabilities:Northstar:Card", amount: "−£15.50" },
            { account: "Expenses:Dining", amount: "+£15.50" },
          ],
          selectable: true,
        },
        {
          id: "cash-withdrawal",
          title: "Cash withdrawal",
          detail: "Choose an account before approving this proposal",
          status: "held",
          amount: "−£40.00",
          selectable: false,
        },
      ],
    },
  ];

  const readyGroups = [
    {
      id: "2026-07-18-ready",
      label: "July 18, 2026",
      rows: [
        {
          id: "grocerly",
          title: "Grocerly",
          detail: "Food and household shopping",
          status: "ready",
          postings: [
            { account: "Liabilities:Northstar:Card", amount: "−£42.17" },
            { account: "Expenses:Groceries", amount: "+£42.17" },
          ],
        },
      ],
    },
  ];
</script>

<script lang="ts">
  let filter = $state<"review" | "ready">("review");
  let selectedIds = $state<string[]>([]);
  let openedTitle = $state("");
</script>

<Story
  name="Review queue selection and queue toggle"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Northstar Cafe" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Ready (1)" }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Ready (1)" }));
    await expect(canvas.getByRole("checkbox", { name: "Select Grocerly" }))
      .toBeInTheDocument();
  }}
>
  {#snippet template()}
    <div class="max-w-6xl p-5">
      <IngestionTable
        groups={filter === "review" ? reviewGroups : readyGroups}
        counts={{ review: 2, ready: 1, duplicates: 1 }}
        {filter}
        {selectedIds}
        onFilterChange={(next) => {
          filter = next;
          selectedIds = [];
        }}
        onSelectedIdsChange={(ids) => {
          selectedIds = ids;
        }}
        onOpenRow={(row) => {
          openedTitle = row.title;
        }}
      />
      <output
        class="mt-3 block text-sm text-muted-foreground"
        aria-label="Selection status"
      >
        {openedTitle}
      </output>
    </div>
  {/snippet}
</Story>

<Story
  name="Shows an empty queue"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("No proposals match the current review filters."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-6xl p-5">
      <IngestionTable
        groups={[]}
        counts={{ review: 0, ready: 0, duplicates: 0 }}
        emptyLabel="No proposals match the current review filters."
      />
    </div>
  {/snippet}
</Story>
