<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import JournalTable from "./JournalTable.svelte";

  const { Story } = defineMeta({
    title: "Tables/Journal Table",
    component: JournalTable,
    parameters: {
      docs: {
        description: {
          component:
            "Reusable journal table surface that owns journal table rendering and selection while remaining application-owned for query state and data derivation.",
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
          id: "coffee-shop",
          title: "Coffee Shop",
          detail: "Daily coffee purchase",
          type: "transaction",
          amount: "−£4.50",
          logoFallback: "C",
          postings: [
            {
              account: "Expenses:Food",
              amount: "−£4.50",
            },
            {
              account: "Assets:Cash",
              amount: "+£4.50",
            },
          ],
        },
        {
          id: "transfer",
          title: "Transfer",
          detail: "Transfer to savings",
          type: "balance",
          amount: "−£20.00",
          logoFallback: "T",
          postings: [
            {
              account: "Assets:Cash",
              amount: "−£20.00",
            },
            {
              account: "Assets:Savings",
              amount: "+£20.00",
            },
          ],
        },
      ],
    },
    {
      id: "2026-07-17",
      date: "17 July 2026",
      balance: "£1,576.67",
      records: [
        {
          id: "salary",
          title: "Salary",
          detail: "Monthly salary",
          type: "balance",
          amount: "£2,000.00",
          logoFallback: "S",
        },
      ],
    },
  ];

  let selectedIds = $state<string[]>([]);
  let openedRecord = $state("");
  let journalTimeframe = $state("transactions");
</script>

<Story
  name="Selects journal records and opens details"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Coffee Shop" }),
    );
    await expect(canvas.getByText("1 record selected")).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "Edit Coffee Shop" }),
    );
    await expect(canvas.getByText("Opened Coffee Shop")).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <JournalTable
        {groups}
        {selectedIds}
        onSelectedIdsChange={(ids) => {
          selectedIds = ids;
        }}
        onOpenRecord={(record) => {
          openedRecord = record.title;
        }}
        onTimeframeChange={(next) => {
          journalTimeframe = next;
        }}
        timeframe={journalTimeframe}
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
  name="Shows an empty upcoming filter"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Upcoming" }));
    await expect(
      canvas.getByText("No upcoming records in this journal view."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <JournalTable
        groups={[]}
        selectable={false}
        timeframe="upcoming"
        emptyMessage="No upcoming records in this journal view."
      />
    </div>
  {/snippet}
</Story>

<Story
  name="Collapses a date group"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse 18 July 2026" }),
    );
    await expect(canvas.queryByText("Start balance")).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <JournalTable {groups} />
    </div>
  {/snippet}
</Story>
