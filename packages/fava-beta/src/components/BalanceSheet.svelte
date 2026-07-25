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
  import { balances } from "../charts/line";
  import type { FavaChart } from "../charts";
  import { useContext } from "../context";
  import { urlForAccount } from "../helpers";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";
  import Chart from "../charts/Chart.svelte";
  import BalanceSheet, {
    type BalanceSheetChart,
    type BalanceSheetSection,
  } from "@lapis/ui/dashboard/BalanceSheet.svelte";

  const { ledgerData, conversion, interval, ledgerOptions } = useContext();

  $: createNodes = () => {
    const tree = $ledgerData.tree.copy();
    const netProfit = tree.netProfit(
      `${$ledgerOptions.beancount.name_equity}:${$ledgerOptions.beancount.account_current_earnings}`,
      $ledgerOptions.beancount,
    );
    tree.insertBalance(netProfit.account, netProfit.balanceChildren);

    return {
      assets: createNode(tree, $ledgerOptions.beancount.name_assets),
      liabilities: createNode(tree, $ledgerOptions.beancount.name_liabilities),
      equity: createNode(tree, $ledgerOptions.beancount.name_equity),
    };
  };

  $: nodes = createNodes();

  $: charts = [
    balances(
      `Net Worth`,
      $ledgerData.netWorth(
        [
          $ledgerOptions.beancount.name_assets,
          $ledgerOptions.beancount.name_liabilities,
        ],
        $conversion,
        $interval,
      ),
    ),
    hierarchyFromParsedData(
      $ledgerOptions.beancount.name_assets,
      $ledgerData.tree
        .get($ledgerOptions.beancount.name_assets)
        .toRecord($conversion),
    ),
    hierarchyFromParsedData(
      $ledgerOptions.beancount.name_liabilities,
      $ledgerData.tree
        .get($ledgerOptions.beancount.name_liabilities)
        .toRecord($conversion),
    ),
    hierarchyFromParsedData(
      $ledgerOptions.beancount.name_equity,
      $ledgerData.tree
        .get($ledgerOptions.beancount.name_equity)
        .toRecord($conversion),
    ),
  ];

  $: sections = [
    {
      tree: nodes.assets,
      title: $ledgerOptions.beancount.name_assets,
      href: urlForAccount($ledgerOptions.beancount.name_assets),
    },
    {
      tree: nodes.liabilities,
      title: $ledgerOptions.beancount.name_liabilities,
      href: urlForAccount($ledgerOptions.beancount.name_liabilities),
    },
    {
      tree: nodes.equity,
      title: $ledgerOptions.beancount.name_equity,
      href: urlForAccount($ledgerOptions.beancount.name_equity),
    },
  ];

  const getChartId = (name: string | undefined) => name || "All";
  let activeChartId = "";

  function handleChartChange(chartId: string) {
    activeChartId = chartId;
  }

  let chartOptions: readonly BalanceSheetChart[] = [];
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

<BalanceSheet
  charts={chartOptions}
  sections={sections as readonly BalanceSheetSection[]}
  activeChartId={selectedChartId}
  onActiveChartChange={handleChartChange}
  chartSwitcherAriaLabel="Balance sheet chart"
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
      href={statementSection.href}
    />
  {/snippet}
</BalanceSheet>
