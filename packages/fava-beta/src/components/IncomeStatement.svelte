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
  import Chart from "../charts/Chart.svelte";
  import { bar } from "../charts/bar";
  import type { FavaChart } from "../charts";
  import { intervalLabel } from "../lib/interval";
  import { useContext } from "../context";
  import { useChartContext } from "../charts/context";
  import { urlForAccount } from "../helpers";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";
  import IncomeStatement, {
    type IncomeStatementChart,
    type IncomeStatementSection,
  } from "@lapis/ui/dashboard/IncomeStatement.svelte";

  const { ledgerData, conversion, interval, ledgerOptions } = useContext();
  const chartContext = useChartContext();

  $: createNodes = () => {
    const tree = $ledgerData.tree.copy();
    const netProfit = tree.netProfit("Net Profit", $ledgerOptions.beancount);

    const income = createNode(tree, $ledgerOptions.beancount.name_income);
    const expenses = createNode(tree, $ledgerOptions.beancount.name_expenses);
    return {
      income,
      expenses,
      netProfit: {
        children: [],
        account: "Net Profit",
        balance: netProfit.balance.toRecord(),
        balanceChildren: netProfit.balanceChildren.toRecord(),
        cost: {},
        costChildren: {},
        hasTxns: netProfit.hasTxns,
      },
    };
  };

  $: nodes = createNodes();

  $: charts = [
    bar(
      `Net Profit`,
      $ledgerData.intervalTotals(
        [
          $ledgerOptions.beancount.name_income,
          $ledgerOptions.beancount.name_expenses,
        ],
        $conversion,
        $interval,
      ),
      $chartContext,
    ),
    bar(
      `Income (${intervalLabel($interval)})`,
      $ledgerData.intervalTotals(
        [$ledgerOptions.beancount.name_income],
        $conversion,
        $interval,
      ),
      $chartContext,
    ),
    bar(
      `Expenses (${intervalLabel($interval)})`,
      $ledgerData.intervalTotals(
        [$ledgerOptions.beancount.name_expenses],
        $conversion,
        $interval,
      ),
      $chartContext,
    ),
    hierarchyFromParsedData(
      "Income",
      $ledgerData.tree
        .get($ledgerOptions.beancount.name_income)
        .toRecord($conversion),
    ),
    hierarchyFromParsedData(
      "Expenses",
      $ledgerData.tree
        .get($ledgerOptions.beancount.name_expenses)
        .toRecord($conversion),
    ),
  ];

  $: sections = [
    {
      tree: nodes.income,
      title: $ledgerOptions.beancount.name_income,
      href: urlForAccount($ledgerOptions.beancount.name_income),
    },
    { tree: nodes.netProfit, title: "Net Profit" },
    {
      tree: nodes.expenses,
      title: $ledgerOptions.beancount.name_expenses,
      href: urlForAccount($ledgerOptions.beancount.name_expenses),
    },
  ];

  const getChartId = (name: string | undefined) => name || "All";
  let activeChartId = "";

  function handleChartChange(chartId: string) {
    activeChartId = chartId;
  }

  let chartOptions: readonly IncomeStatementChart[] = [];
  $: chartOptions = charts.map((chart) => ({
    id: getChartId(chart.name),
    label: chart.name || "All",
  }));

  $: selectedChartId =
    chartOptions.some((chart) => chart.id === activeChartId) && activeChartId
      ? activeChartId
      : chartOptions[0]?.id ?? "";

  $: chartById =
    new Map(
      charts.map((chart) => [getChartId(chart.name), chart]),
    ) as ReadonlyMap<string, FavaChart>;

  const mapForChart = (chartId: string) => chartById.get(chartId) ?? charts[0];
</script>

<IncomeStatement
  charts={chartOptions}
  sections={sections as readonly IncomeStatementSection[]}
  activeChartId={selectedChartId}
  onActiveChartChange={handleChartChange}
  chartSwitcherAriaLabel="Income statement chart"
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
</IncomeStatement>
