<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ActivityTable from "./ActivityTable.svelte";

  const { Story } = defineMeta({
    title: "Tables/Activity Table",
    component: ActivityTable,
    parameters: {
      docs: {
        description: {
          component:
            "Shared journal-style activity list with timeframe controls, grouped rows, posting rows, and controlled selection. Keep this surface free of route and ledger derivation logic; the application owns those concerns.",
        },
      },
    },
  });
</script>

<script lang="ts">
  const groups = [
    {
      id: "2026-07-18",
      date: "18 July 2026",
      balance: "£1,552.17",
      summary: {
        start: "£1,552.17",
        change: "—",
        final: "£1,552.17",
      },
      records: [
        {
          id: "groceries",
          title: "Groceries",
          detail: "Weekly household shopping",
          type: "transaction",
          amount: "−£42.17",
          logoFallback: "G",
          postings: [
            {
              account: "Expenses:Groceries",
              amount: "£42.17",
              href: "/account/Expenses:Groceries",
            },
            {
              account: "Assets:Cash",
              amount: "−£42.17",
            },
          ],
        },
        {
          id: "salary",
          title: "Salary",
          detail: "Monthly salary payment",
          type: "balance",
          amount: "+£3,200.00",
          logoFallback: "S",
          postings: [
            {
              account: "Assets:Cash",
              amount: "+£3,200.00",
            },
            {
              account: "Income:Salary",
              amount: "−£3,200.00",
            },
          ],
        },
      ],
    },
    {
      id: "2026-07-17",
      date: "17 July 2026",
      balance: "£1,087.83",
      records: [
        {
          id: "utilities",
          title: "Electricity bill",
          detail: "Monthly utility bill",
          type: "transaction",
          amount: "−£86.55",
          logoFallback: "E",
        },
      ],
    },
  ];

  let selectedIds = $state<string[]>([]);
  let openedRecord = $state("");
  let activityTimeframe = $state("transactions");
</script>

<Story
  name="Selects records and opens details"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: "Select Groceries" }));
    await expect(canvas.getByText("1 record selected")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Edit Groceries" }));
    await expect(canvas.getByText("Opened Groceries")).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <ActivityTable
        {groups}
        {selectedIds}
        onSelectedIdsChange={(ids) => {
          selectedIds = ids;
        }}
        onOpenRecord={(record) => {
          openedRecord = record.title;
        }}
        onTimeframeChange={(next) => {
          activityTimeframe = next;
        }}
        timeframe={activityTimeframe}
      />
      <output class="sr-only" aria-live="polite">
        {openedRecord
          ? `Opened ${openedRecord}`
          : `${selectedIds.length} record${selectedIds.length === 1 ? "" : "s"} selected`}
      </output>
    </div>
  {/snippet}
</Story>

<Story
  name="Collapses a date group"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /18 July 2026/ }));
    await expect(canvas.queryByText("Start balance")).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <ActivityTable {groups} selectable={false} />
    </div>
  {/snippet}
</Story>

<Story
  name="Explains an empty filtered result"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("No dated records match the current filter."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <ActivityTable groups={[]} selectable={false} />
    </div>
  {/snippet}
</Story>
