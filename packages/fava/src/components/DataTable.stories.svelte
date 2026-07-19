<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { ColumnDef } from "@tanstack/table-core";
  import DataTable from "./DataTable.svelte";

  type Transaction = {
    date: string;
    description: string;
    account: string;
    amount: string;
  };

  const columns: ColumnDef<Transaction>[] = [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "account", header: "Account" },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (info) => info.getValue<string>(),
    },
  ];

  const transactions: Transaction[] = [
    {
      date: "18 Jul 2026",
      description: "Groceries",
      account: "Expenses:Groceries",
      amount: "£42.17",
    },
    {
      date: "17 Jul 2026",
      description: "Salary",
      account: "Income:Salary",
      amount: "£3,200.00",
    },
  ];

  const { Story } = defineMeta({
    title: "Fava/Data Display/Data Table",
    component: DataTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's small typed-table composition over TanStack Table. Use it for conventional fixed-column application tables; domain-specific journal, query, and tree tables keep their own interaction stories.",
        },
      },
    },
  });
</script>

<Story name="Renders typed ledger rows">
  {#snippet template()}
    <div class="max-w-3xl">
      <DataTable data={transactions} {columns} />
    </div>
  {/snippet}
</Story>

<Story name="Shows an empty result state">
  {#snippet template()}
    <div class="max-w-3xl">
      <DataTable data={[]} {columns} />
    </div>
  {/snippet}
</Story>
