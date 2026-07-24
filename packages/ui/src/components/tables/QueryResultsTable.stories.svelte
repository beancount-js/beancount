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
            "A formatted, client-sortable query result table. Supply precomputed display values and controlled page ranges from the query layer; this visual primitive intentionally does not parse BQL or infer account and money formatting.",
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
    {
      id: "utilities",
      values: {
        date: "16 Jul 2026",
        description: "Household utilities",
        account: "Expenses:Utilities",
        amount: "-86.55",
      },
    },
    {
      id: "salary",
      values: {
        date: "15 Jul 2026",
        description: "Salary payment",
        account: "Income:Salary",
        amount: "3200.00",
      },
    },
  ];

  const holdingsColumns = [
    { id: "account", label: "account", sortable: true },
    { id: "units", label: "units", sortable: true, align: "right" as const },
    { id: "cost", label: "cost", sortable: true, align: "right" as const },
    { id: "price", label: "price", sortable: true, align: "right" as const },
    {
      id: "book_value",
      label: "book_value",
      sortable: true,
      align: "right" as const,
    },
    {
      id: "market_value",
      label: "market_value",
      sortable: true,
      align: "right" as const,
    },
    {
      id: "acquisition_date",
      label: "acquisition_date",
      sortable: true,
      align: "right" as const,
    },
  ];

  const holdingsRows = [
    ["Assets:Cash", "70.00"],
    ["Assets:Checking:Monzo", "7637.59"],
    ["Assets:Checking:Starling", "17214.19"],
    ["Liabilities:CreditCard:Amex", "3377.90"],
    ["Liabilities:CreditCard:Barclays", "2365.62"],
    ["Liabilities:CreditCard:Mbna", "976.61"],
    ["Liabilities:CreditCard:Natwest", "-4150.00"],
    ["Liabilities:CreditCard:PayPal", "-2002.45"],
    ["Liabilities:Loan:Miriam", "-1000.00"],
    ["Liabilities:Loan:Novuna", "1896.40"],
  ].map(([account, amount]) => ({
    id: account,
    values: {
      account,
      units: amount,
      cost: "",
      price: "",
      book_value: amount,
      market_value: amount,
      acquisition_date: "",
    },
  }));
</script>

<script lang="ts">
  let queryPage = $state(1);
  let queryPageSize = $state(2);

  function visibleRows() {
    const start = (queryPage - 1) * queryPageSize;
    return rows.slice(start, start + queryPageSize);
  }

  function resultLabel() {
    const start = (queryPage - 1) * queryPageSize + 1;
    const end = Math.min(queryPage * queryPageSize, rows.length);
    return `Showing ${start}–${end} of ${rows.length}`;
  }
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
      <QueryResultsTable {columns} rows={rows.slice(0, 2)} />
    </div>
  {/snippet}
</Story>

<Story
  name="Changes controlled query pages"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Go to next page" }),
    );
    await expect(canvas.getByText("Household utilities")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Showing 3–4 of 4",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <QueryResultsTable
        {columns}
        rows={visibleRows()}
        pagination={{
          page: queryPage,
          pageCount: Math.ceil(rows.length / queryPageSize),
          resultLabel: resultLabel(),
          pageSize: queryPageSize,
          pageSizes: [2, 4],
        }}
        onPageChange={(page) => {
          queryPage = page;
        }}
        onPageSizeChange={(pageSize) => {
          queryPageSize = pageSize;
          queryPage = 1;
        }}
      />
      <output class="sr-only" aria-live="polite">{resultLabel()}</output>
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

<Story name="Holdings results">
  {#snippet template()}
    <div style="width: 982px">
      <QueryResultsTable
        columns={holdingsColumns}
        rows={holdingsRows}
        pagination={{
          page: 1,
          pageCount: 2,
          resultLabel: "Showing 1–10 of 12",
          pageSize: 10,
          pageSizes: [10, 25, 50, 100],
        }}
      />
    </div>
  {/snippet}
</Story>
