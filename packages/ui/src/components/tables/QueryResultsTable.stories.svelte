<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import QueryResultsTable from "./QueryResultsTable.svelte";

  const { Story } = defineMeta({
    title: "Tables/Query Results Table",
    component: QueryResultsTable,
    parameters: {
      docs: {
        description: {
          component:
            "A formatted, client-sortable query result table. Supply precomputed display values from the query layer; this visual primitive intentionally does not parse BQL or infer account and money formatting.",
        },
      },
    },
  });

  const columns = [
    { id: "date", label: "Date", sortable: true },
    { id: "description", label: "Description", sortable: true },
    { id: "account", label: "Account" },
    { id: "amount", label: "Amount", sortable: true, align: "right" as const },
  ];

  const rows = [
    {
      id: "groceries",
      values: {
        date: "18 Jul 2026",
        description: "Groceries",
        account: "Expenses:Groceries",
        amount: "-42.17",
      },
    },
    {
      id: "refund",
      values: {
        date: "17 Jul 2026",
        description: "Alpha refund",
        account: ["Assets:Cash", "Income:Refunds"],
        amount: "12.50",
      },
    },
  ];
</script>

<Story
  name="Sorts formatted query rows"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Sort by Description" }),
    );
    await expect(
      canvas.getByRole("columnheader", { name: "Description" }),
    ).toHaveAttribute("aria-sort", "ascending");
    await expect(canvas.getAllByRole("row")[1]).toHaveTextContent(
      "Alpha refund",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <QueryResultsTable {columns} {rows} />
    </div>
  {/snippet}
</Story>

<Story
  name="Keeps a query failure actionable"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Unexpected token near FROM",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <QueryResultsTable
        {columns}
        rows={[]}
        emptyLabel="No matching rows."
        error="Unexpected token near FROM"
      />
    </div>
  {/snippet}
</Story>
