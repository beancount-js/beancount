<script lang="ts">
  import { createNode } from "../core/tree";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import { balances } from "../charts/line";
  import { useContext } from "../context";
  import { urlForAccount } from "../helpers";
  import StatementReport from "./StatementReport.svelte";

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
</script>

<StatementReport {charts} {sections} />
