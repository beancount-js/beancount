<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ChartLegend from "../charts/ChartLegend.svelte";
  import ChartModeSwitch from "../charts/ChartModeSwitch.svelte";
  import HierarchyChart from "../charts/HierarchyChart.svelte";
  import AccountNavigationLink from "../navigation/AccountNavigationLink.svelte";
  import QueryResultsTable, {
    type QueryResultCell,
    type QueryResultColumn,
    type QueryResultRow,
  } from "../tables/QueryResultsTable.svelte";
  import PresetQueryView from "./PresetQueryView.svelte";

  const { Story } = defineMeta({
    title: "Pages/Holdings",
    component: PresetQueryView,
    parameters: {
      layout: "fullscreen",
      docs: {
        description: {
          component:
            "The reusable Holdings page composition. Fava Beta owns BQL execution, formatting, chart derivation, and routes; the UI package owns the preset, chart, table, account-link, and pagination presentation shown here.",
        },
      },
    },
  });

  const queries = [
    {
      id: "holdings",
      name: "Holdings",
      query: "SELECT account, units(sum(position))",
    },
    {
      id: "holdings-by-account",
      name: "Holdings by Account",
      query: "SELECT account, cost(sum(position)) GROUP BY account",
    },
    {
      id: "holdings-by-currency",
      name: "Holdings by Currency",
      query: "SELECT currency, units(sum(position)) GROUP BY currency",
    },
    {
      id: "holdings-by-cost-currency",
      name: "Holdings by Cost currency",
      query: "SELECT cost_currency, cost(sum(position)) GROUP BY cost_currency",
    },
  ];

  const columns: QueryResultColumn[] = [
    { id: "account", label: "account", sortable: true },
    { id: "units", label: "units", sortable: true, align: "right" },
  ];
  const rows: QueryResultRow[] = Array.from({ length: 12 }, (_, index) => ({
    id: String(index + 1),
    values: {
      account: index % 2 === 0 ? "Assets:Cash" : "Assets:Investments:Brokerage",
      units: `£${(1250 - index * 37).toLocaleString("en-GB")}.00`,
    },
  }));
  const hierarchy = {
    id: "assets",
    label: "Holdings",
    valueLabel: "£2,500.00",
    color: "var(--primary)",
    children: [
      {
        id: "cash",
        label: "Cash",
        value: 1250,
        valueLabel: "£1,250.00",
        color: "var(--chart-2)",
      },
      {
        id: "brokerage",
        label: "Brokerage",
        value: 1250,
        valueLabel: "£1,250.00",
        color: "var(--primary)",
      },
    ],
  };
</script>

<script lang="ts">
  let selectedQuery = $state("holdings");
  let queryPage = $state(1);
  let chartMode = $state<"treemap" | "sunburst">("treemap");
  let currencies = $state(["GBP"]);

  function visibleRows() {
    const start = (queryPage - 1) * 10;
    return rows.slice(start, start + 10);
  }
</script>

<Story
  name="Preset query view"
  play={async ({ canvas }) => {
    const accountTab = canvas.getByRole("tab", {
      name: "Holdings by Account",
    });
    await userEvent.click(accountTab);
    await expect(accountTab).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("table", { name: "Holdings" })).toBeVisible();
    await expect(
      canvas.getAllByRole("link", { name: /^Assets:Cash$/ })[0],
    ).toBeVisible();
    await expect(canvas.getByTestId("selected-query-label")).toHaveTextContent(
      "Selected Holdings by Account",
    );
  }}
>
  {#snippet template()}
    <div style="height: 838px; width: 1014px">
      <PresetQueryView
        {queries}
        value={selectedQuery}
        scrollTabs
        queryHref={(query) =>
          `/query?qs=${encodeURIComponent(query.query.trim())}`}
        onValueChange={(id) => {
          selectedQuery = id;
        }}
      >
        {#snippet children(query)}
          <div class="mt-4 rounded-xl border bg-card p-3 shadow-sm">
            <div class="mb-3 flex items-center justify-between gap-3">
              <ChartLegend
                items={[
                  { id: "GBP", label: "GBP" },
                  { id: "USD", label: "USD" },
                ]}
                selection="single"
                selectedIds={currencies}
                onSelectedIdsChange={(ids) => {
                  currencies = ids;
                }}
              />
              <ChartModeSwitch
                value={chartMode}
                options={[
                  { value: "treemap", label: "Treemap" },
                  { value: "sunburst", label: "Sunburst" },
                ]}
                ariaLabel="Hierarchy representation"
                onChange={(value) => {
                  chartMode = value as "treemap" | "sunburst";
                }}
              />
            </div>
            <HierarchyChart root={hierarchy} mode={chartMode} />
          </div>
          <QueryResultsTable
            {columns}
            rows={visibleRows()}
            ariaLabel="Holdings"
            pagination={{
              page: queryPage,
              pageCount: 2,
              resultLabel: `Showing ${(queryPage - 1) * 10 + 1}–${Math.min(queryPage * 10, rows.length)} of ${rows.length}`,
              pageSize: 10,
              pageSizes: [10, 25, 50, 100],
            }}
            onPageChange={(page) => {
              queryPage = page;
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
      </PresetQueryView>
      <output
        class="sr-only"
        aria-live="polite"
        data-testid="selected-query-label"
      >
        Selected {queries.find((query) => query.id === selectedQuery)?.name}
      </output>
    </div>
  {/snippet}
</Story>
