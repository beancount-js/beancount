<script lang="ts">
  import { stratify } from "../lib/tree";
  import type { AccountTreeNode } from "../lib/models";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import { bar } from "../charts/bar";
  import { intervalLabel } from "../lib/interval";
  import { useContext } from "../context";
  import { useChartContext } from "../charts/context";
  import ContentScrollArea from "./ContentScrollArea.svelte";
  import { urlForAccount } from "../helpers";

  const { ledgerData, conversion, interval, ledgerOptions } = useContext();
  const chartContext = useChartContext();

  $: createNodes = () => {
    const tree = $ledgerData.tree.copy();
    const netProfit = tree.netProfit("Net Profit", $ledgerOptions.beancount);

    function createNode(parent: string) {
      return stratify(
        tree.get(parent).accounts,
        (id) => id,
        (name) => {
          const node = tree.get(name);
          const entity: AccountTreeNode = {
            children: [],
            account: name,
            balance: node.balance.toRecord(),
            balanceChildren: node.balanceChildren.toRecord(),
            cost: {},
            costChildren: {},
            hasTxns: node.hasTxns,
          };
          return entity;
        },
      );
    }

    const income = createNode("Income");
    const expenses = createNode("Expenses");
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
</script>

<ContentScrollArea contentClass="scroll-container min-h-full">
  <div class="p-4">
    <ChartSwitcher {charts} />
  </div>
  <div class="grid w-full gap-8 p-4">
    <StatementSummaryTreeTable
      tree={nodes.income}
      title={$ledgerOptions.beancount.name_income}
      href={urlForAccount($ledgerOptions.beancount.name_income)}
    />
    <StatementSummaryTreeTable tree={nodes.netProfit} title="Net Profit" />
    <StatementSummaryTreeTable
      tree={nodes.expenses}
      title={$ledgerOptions.beancount.name_expenses}
      href={urlForAccount($ledgerOptions.beancount.name_expenses)}
    />
  </div>
</ContentScrollArea>
