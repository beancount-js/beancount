<script lang="ts">
  import { stratify } from "../lib/tree";
  import type { AccountTreeNode } from "../lib/models";
  import TreeTableComponent from "./tree-table/TreeTable.svelte";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";
  import { balances } from "../charts/line";
  import { useContext } from "../context";
  import ContentScrollArea from "./ContentScrollArea.svelte";

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

<ContentScrollArea contentClass="scroll-container">
  <div class="p-2">
    <ChartSwitcher {charts} />
  </div>
  <div class="flex">
    <div class="flex flex-wrap justify-center">
      <div class="p-2">
        <TreeTableComponent tree={nodes.assets} end={null}></TreeTableComponent>
      </div>
      <div class="p-2">
        <TreeTableComponent tree={nodes.liabilities} end={null}
        ></TreeTableComponent>
        <TreeTableComponent tree={nodes.equity} end={null}></TreeTableComponent>
      </div>
    </div>
  </div>
</ContentScrollArea>
