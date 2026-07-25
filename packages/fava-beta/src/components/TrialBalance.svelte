<script context="module" lang="ts">
  import type { AccountTreeNode } from "../lib/models";

  export type StatementSection = {
    tree: AccountTreeNode;
    title: string;
    href?: string;
  };
</script>

<script lang="ts">
  import { createNode } from "../core/tree";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import type { FavaChart } from "../charts";
  import { useContext } from "../context";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";
  import Chart from "../charts/Chart.svelte";
  import type { Readable } from "svelte/store";
  import type { LedgerData } from "../lib/ledger-data";
  import TrialBalance, {
    type TrialBalanceChart,
    type TrialBalanceSection,
  } from "@lapis/ui/dashboard/TrialBalance.svelte";

  const context = useContext();

  export let ledgerData: Readable<LedgerData> = context.ledgerData;

  const accountOrder = [
    "Income",
    "Expenses",
    "Assets",
    "Liabilities",
    "Equity",
  ] as const;

  $: node = createNode($ledgerData.tree, "");
  $: charts = accountOrder.map((account) =>
    hierarchyFromParsedData(account, $ledgerData.tree.get(account).toRecord()),
  );

  $: sections = [
    {
      tree: node,
      title: "Trial Balance",
    },
  ];

  const getChartId = (name: string | undefined) => name || "All";
  let activeChartId = "";

  function handleChartChange(chartId: string) {
    activeChartId = chartId;
  }

  let chartOptions: readonly TrialBalanceChart[] = [];
  $: chartOptions = charts.map((chart) => ({
    id: getChartId(chart.name),
    label: chart.name || "All",
  }));

  $: selectedChartId =
    chartOptions.some((chart) => chart.id === activeChartId) && activeChartId
      ? activeChartId
      : chartOptions[0]?.id ?? "";

  $: chartById =
    new Map(charts.map((chart) => [getChartId(chart.name), chart])) as ReadonlyMap<
      string,
      FavaChart
    >;

  const mapForChart = (chartId: string) => chartById.get(chartId);
</script>

<TrialBalance
  charts={chartOptions}
  sections={sections as readonly TrialBalanceSection[]}
  activeChartId={selectedChartId}
  onActiveChartChange={handleChartChange}
  chartSwitcherAriaLabel="Trial balance chart"
>
  {#snippet chartChildren(chartId)}
    {#if chartId}
      {@const chart = mapForChart(chartId)}
      {#if chart}
        <Chart {chart} />
      {/if}
    {/if}
  {/snippet}
  {#snippet sectionChildren(section)}
    {@const statementSection = section as unknown as StatementSection}
    <StatementSummaryTreeTable
      tree={statementSection.tree}
      title={statementSection.title}
    />
  {/snippet}
</TrialBalance>
