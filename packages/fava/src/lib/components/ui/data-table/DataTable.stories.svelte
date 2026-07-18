<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { type ColumnDef, getCoreRowModel } from "@tanstack/table-core";
  import * as Table from "$lib/components/ui/table";
  import { createSvelteTable, FlexRender } from "./index.js";

  type Transaction = {
    date: string;
    description: string;
    amount: string;
  };

  const transactions: Transaction[] = [
    { date: "18 Jul 2026", description: "Groceries", amount: "£42.17" },
    { date: "17 Jul 2026", description: "Salary", amount: "£3,200.00" },
  ];

  const columns: ColumnDef<Transaction>[] = [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "description", header: "Description" },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (info) => info.getValue<string>(),
    },
  ];

  const { Story } = defineMeta({
    title: "Shadcn/Data Display/Data Table",
    component: FlexRender,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local TanStack Table adapter. Use it to render typed column definitions with the shared table structure; keep sorting and selection state in the consuming feature.",
        },
      },
    },
  });
</script>

<script lang="ts">
  const table = createSvelteTable({
    get data() {
      return transactions;
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
</script>

<Story name="Renders typed transaction rows">
  {#snippet template()}
    <div class="max-w-2xl rounded-md border">
      <Table.Root>
        <Table.Caption>Recent ledger transactions</Table.Caption>
        <Table.Header>
          {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <Table.Row>
              {#each headerGroup.headers as header (header.id)}
                <Table.Head>
                  {#if !header.isPlaceholder}
                    <FlexRender
                      content={header.column.columnDef.header}
                      context={header.getContext()}
                    />
                  {/if}
                </Table.Head>
              {/each}
            </Table.Row>
          {/each}
        </Table.Header>
        <Table.Body>
          {#each table.getRowModel().rows as row (row.id)}
            <Table.Row>
              {#each row.getVisibleCells() as cell (cell.id)}
                <Table.Cell>
                  <FlexRender
                    content={cell.column.columnDef.cell}
                    context={cell.getContext()}
                  />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/snippet}
</Story>
