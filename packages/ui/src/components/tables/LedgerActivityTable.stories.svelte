<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import LedgerActivityTable from "./LedgerActivityTable.svelte";

  const { Story } = defineMeta({
    title: "Tables/Ledger Activity Table",
    component: LedgerActivityTable,
    parameters: {
      docs: {
        description: {
          component:
            "A model-driven ledger activity surface. It owns visual grouping, disclosure, selection, and record actions while the application supplies ledger-derived data and routing callbacks. Use this instead of rebuilding a journal-like list in a route.",
        },
      },
    },
  });

  const groups = [
    {
      id: "2026-07-18",
      date: "18 July 2026",
      balance: "£1,510.00",
      records: [
        {
          id: "groceries",
          description: "Groceries",
          account: "Expenses:Groceries",
          detail: "Weekly household shopping",
          amount: "−£42.17",
        },
        {
          id: "salary",
          description: "Salary",
          account: "Income:Salary",
          amount: "+£3,200.00",
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
          description: "Electricity bill",
          account: "Expenses:Utilities",
          amount: "−£86.55",
        },
      ],
    },
  ];
</script>

<script lang="ts">
  let selectedIds = $state<string[]>([]);
  let openedRecord = $state("");
</script>

<Story
  name="Selects records and opens their details"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Groceries" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "1 record selected",
    );

    await userEvent.click(canvas.getByRole("button", { name: /Groceries/ }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Opened Groceries",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <LedgerActivityTable
        {groups}
        {selectedIds}
        onSelectedIdsChange={(ids) => {
          selectedIds = ids;
        }}
        onOpenRecord={(record) => {
          openedRecord = record.description;
        }}
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
    await expect(
      canvas.queryByText("Weekly household shopping"),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <LedgerActivityTable {groups} selectable={false} />
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
      <LedgerActivityTable groups={[]} />
    </div>
  {/snippet}
</Story>
