<script context="module" lang="ts">
  import type { AccountTreeNode } from "../lib/models";

  export type StatementSection = {
    tree: AccountTreeNode;
    title: string;
    href?: string;
  };
</script>

<script lang="ts">
  import Chart from "../charts/Chart.svelte";
  import { useContext } from "../context";
  import type { FavaChart } from "../charts";
  import StatementReport, {
    type StatementReportChart,
    type StatementReportSection,
  } from "@beancount-js/ui/dashboard/StatementReport.svelte";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";
  
  export let charts: FavaChart[] = [];
  export let sections: StatementSection[] = [];

  const { lastActiveChartName } = useContext();

  const getChartId = (chart: FavaChart) => chart.name || "All";

  let chartOptions: readonly StatementReportChart[] = [];
  $: chartOptions = charts.map((chart) => ({
    id: getChartId(chart),
    label: chart.name || "All",
  }));

  $: selectedChart =
    charts.find((chart) => chart.name === $lastActiveChartName) ?? charts[0];
  $: selectedChartId = selectedChart ? getChartId(selectedChart) : "";

  function handleChartChange(chartId: string) {
    lastActiveChartName.set(chartId === "All" ? null : chartId || null);
  }
</script>

<StatementReport
  charts={chartOptions}
  sections={sections as readonly StatementReportSection[]}
  activeChartId={selectedChartId}
  onActiveChartChange={(value) => handleChartChange(value)}
  chartSwitcherAriaLabel="Statement report chart"
>
  {#snippet chartChildren(chartId)}
    {#if chartId}
      {#each charts as chart}
        {#if getChartId(chart) === chartId}
          <Chart {chart} />
        {/if}
      {/each}
    {/if}
  {/snippet}
  {#snippet sectionChildren(section)}
    {@const statementSection = section as unknown as StatementSection}
    <StatementSummaryTreeTable
      tree={statementSection.tree}
      title={statementSection.title}
      href={statementSection.href}
    />
  {/snippet}
</StatementReport>
