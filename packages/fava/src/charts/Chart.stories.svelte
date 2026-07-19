<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import Chart from "./Chart.svelte";

  const { Story } = defineMeta({
    title: "Fava/Charts/Chart",
    component: Chart,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's chart renderer. It applies the shared conversion, interval, legend, and mode controls to the supplied Fava chart data; application pages choose the data and chart type rather than duplicating those controls.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { lineChartMode } from "../stores/chart";
  import { BarChart } from "./bar";
  import { hierarchyFromParsedData } from "./hierarchy";
  import { balances } from "./line";
  import { scatterplot } from "./scatterplot";

  const context = createContext();
  context.ledgerSource.set(
    new LedgerSource('option "operating_currency" "GBP"', {
      logTimings: undefined,
    }),
  );
  setContext(ContextKey, context);

  const netWorth = balances("Net worth", [
    { date: new Date("2026-05-01"), balance: { GBP: 1240 } },
    { date: new Date("2026-06-01"), balance: { GBP: 1425 } },
    { date: new Date("2026-07-01"), balance: { GBP: 1510 } },
  ]);

  const spending = new BarChart(
    "Monthly spending",
    ["GBP"],
    [
      {
        label: "May 2026",
        date: new Date("2026-05-01"),
        values: [{ currency: "GBP", value: -420, budget: -400 }],
        accountBalances: {
          "Expenses:Groceries": { GBP: -300 },
          "Expenses:Utilities": { GBP: -120 },
        },
      },
      {
        label: "June 2026",
        date: new Date("2026-06-01"),
        values: [{ currency: "GBP", value: -385, budget: -400 }],
        accountBalances: {
          "Expenses:Groceries": { GBP: -275 },
          "Expenses:Utilities": { GBP: -110 },
        },
      },
    ],
  );

  const accounts = hierarchyFromParsedData(
    "Asset allocation",
    {
      account: "Assets",
      balance: {},
      children: [
        { account: "Assets:Cash", balance: { GBP: 510 }, children: [] },
        { account: "Assets:Bank", balance: { GBP: 1000 }, children: [] },
      ],
    },
    ["GBP"],
  );

  const events = scatterplot("Ledger events", [
    {
      date: new Date("2026-05-12"),
      type: "Transaction",
      description: "Groceries",
    },
    {
      date: new Date("2026-06-03"),
      type: "Transaction",
      description: "Utility bill",
    },
  ]);
</script>

<Story
  name="Changes the line representation"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Area Map" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Area map");
  }}
>
  {#snippet template()}
    <div class="max-w-4xl rounded-xl border bg-card p-4 shadow-sm">
      <Chart chart={netWorth} />
    </div>
    <output class="sr-only" aria-live="polite">
      Line representation: {$lineChartMode === "area"
        ? "Area map"
        : "Line chart"}
    </output>
  {/snippet}
</Story>

<Story name="Renders a stacked bar chart">
  {#snippet template()}
    <div class="max-w-4xl rounded-xl border bg-card p-4 shadow-sm">
      <Chart chart={spending} />
    </div>
  {/snippet}
</Story>

<Story name="Renders an account hierarchy">
  {#snippet template()}
    <div class="max-w-4xl rounded-xl border bg-card p-4 shadow-sm">
      <Chart chart={accounts} />
    </div>
  {/snippet}
</Story>

<Story name="Renders dated ledger events">
  {#snippet template()}
    <div class="max-w-4xl rounded-xl border bg-card p-4 shadow-sm">
      <Chart chart={events} />
    </div>
  {/snippet}
</Story>
