<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import QueryResultsTable, {
    type QueryResultColumn,
    type QueryResultRow,
    type QueryResultCell,
  } from "../tables/QueryResultsTable.svelte";
  import AccountNavigationLink from "../navigation/AccountNavigationLink.svelte";
  import Statistics from "./Statistics.svelte";

  const { Story } = defineMeta({
    title: "Pages/Statistics",
    component: Statistics,
    parameters: {
      layout: "fullscreen",
      docs: {
        description: {
          component:
            "The reusable Statistics page composition. Fava Beta owns query execution and formatting; the UI package owns preset selection and action layout shown here.",
        },
      },
    },
  });

  const queries = [
    {
      id: "postings-per-account",
      name: "Postings per Account",
      query: "SELECT account, count(account)",
    },
    {
      id: "update-activity",
      name: "Update Activity",
      query: "SELECT account, last_entry FROM postings GROUP BY account",
    },
    {
      id: "entries-per-type",
      name: "Entries Per Type",
      query: "SELECT type, count(type) FROM entries GROUP BY type",
    },
  ];

  const columns: QueryResultColumn[] = [
    { id: "account", label: "account", sortable: false },
    { id: "count", label: "count", sortable: false, align: "right" },
  ];

  const rows: QueryResultRow[] = [
    {
      id: "row-1",
      values: {
        account: "Assets:Cash",
        count: "2",
      },
    },
    {
      id: "row-2",
      values: {
        account: "Expenses:Food",
        count: "4",
      },
    },
    {
      id: "row-3",
      values: {
        account: "Liabilities:Card",
        count: "1",
      },
    },
  ];
</script>

<script lang="ts">
  let selectedQuery = $state("postings-per-account");
</script>

<Story
  name="Statistics presets"
  play={async ({ canvas }) => {
    const tableTab = canvas.getByRole("tab", { name: "Update Activity" });
    await userEvent.click(tableTab);
    await expect(tableTab).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("link", { name: /Assets:Cash/ })).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="h-[40rem] rounded-xl border bg-background p-4 shadow-sm">
      <Statistics
        {queries}
        value={selectedQuery}
        alignQueryActionEnd
        queryHref={(query) => `/query?qs=${encodeURIComponent(query.query.trim())}`}
        onValueChange={(id) => {
          selectedQuery = id;
        }}
      >
        {#snippet children(query)}
          <div class="mt-4 rounded-md border bg-card p-3 shadow-sm">
            Query: {query.name}
          </div>
          <QueryResultsTable
            {columns}
            rows={rows}
            ariaLabel="Statistics"
            pagination={{
              page: 1,
              pageCount: 1,
              resultLabel: `Showing 1–${rows.length} of ${rows.length}`,
              pageSize: rows.length,
              pageSizes: [rows.length],
            }}
          >
            {#snippet cell(
              _row: QueryResultRow,
              column: QueryResultColumn,
              value: QueryResultCell,
            )}
              {#if column.id === "account"}
                <AccountNavigationLink
                  account={String(value)}
                  href={`/accounts/${encodeURIComponent(String(value))}`}
                  appearance={{ color: "#c2410c" }}
                />
              {:else}
                <span>{String(value)}</span>
              {/if}
            {/snippet}
          </QueryResultsTable>
        {/snippet}
      </Statistics>
    </div>
  {/snippet}
</Story>
