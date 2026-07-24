<script lang="ts">
  import { createNode } from "../core/tree";
  import type { AccountTreeNode } from "../lib/models";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import { bar } from "../charts/bar";
  import { intervalLabel } from "../lib/interval";
  import { useContext } from "../context";
  import { useChartContext } from "../charts/context";
  import { urlForAccount } from "../helpers";
  import StatementReport from "./StatementReport.svelte";

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
</script>

<StatementReport {charts} {sections} />
