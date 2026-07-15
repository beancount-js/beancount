<script lang="ts">
  import { stratify } from "../lib/tree";
  import type { AccountTreeNode } from "../lib/models";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";
  import { balances } from "../charts/line";
  import { useContext } from "../context";
  import ContentScrollArea from "./ContentScrollArea.svelte";
  import { urlForAccount } from "../helpers";

  const { ledgerData, conversion, interval, ledgerOptions } = useContext();

  $: createNodes = () => {
    const tree = $ledgerData.tree.copy();
    const netProfit = tree.netProfit(
      `${$ledgerOptions.beancount.name_equity}:${$ledgerOptions.beancount.account_current_earnings}`,
      $ledgerOptions.beancount,
    );
    tree.insertBalance(netProfit.account, netProfit.balanceChildren);

    function createNode(account: string) {
      return stratify(
        tree.get(account).accounts,
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
    return {
      assets: createNode("Assets"),
      liabilities: createNode("Liabilities"),
      equity: createNode("Equity"),
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
</script>

<ContentScrollArea contentClass="scroll-container min-h-full">
  <div class="p-4">
    <ChartSwitcher {charts} />
  </div>
  <div class="grid w-full gap-8 p-4">
    <StatementSummaryTreeTable
      tree={nodes.assets}
      title={$ledgerOptions.beancount.name_assets}
      href={urlForAccount($ledgerOptions.beancount.name_assets)}
    />
    <StatementSummaryTreeTable
      tree={nodes.liabilities}
      title={$ledgerOptions.beancount.name_liabilities}
      href={urlForAccount($ledgerOptions.beancount.name_liabilities)}
    />
    <StatementSummaryTreeTable
      tree={nodes.equity}
      title={$ledgerOptions.beancount.name_equity}
      href={urlForAccount($ledgerOptions.beancount.name_equity)}
    />
  </div>
</ContentScrollArea>
