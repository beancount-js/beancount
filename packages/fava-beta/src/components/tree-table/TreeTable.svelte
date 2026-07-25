<script lang="ts">
  import { leaf } from "$lib/accounts";
  import type { DateTime } from "luxon";
  import { useContext } from "../../context";
  import { useCtx } from "../../stores/format";
  import type { AccountTreeNode } from "../../lib/models";
  import { getCollapsed, useGetNotShown } from "./helpers";
  import { useCollapseAccount, useInvertAccount } from "../../stores/account";
  import { urlForAccount } from "../../helpers";
  import TreeTable from "@beancount-js/ui/tables/TreeTable.svelte";

  type UiTreeTableNode = {
    readonly account: string;
    readonly balance: Readonly<Record<string, number>>;
    readonly balanceChildren: Readonly<Record<string, number>>;
    readonly cost: Readonly<Record<string, number>>;
    readonly costChildren: Readonly<Record<string, number>>;
    readonly invert?: number;
    readonly children: readonly UiTreeTableNode[];
  };

  const { currencyName, operatingCurrency } = useContext();
  const ctx = useCtx();
  const getNotShown = useGetNotShown();
  const collapseAccount = useCollapseAccount();
  const invertAccount = useInvertAccount();

  /** The account tree to show. */
  export let tree: AccountTreeNode;
  /** The end date (for closed accounts). */
  export let end: DateTime | null;

  let hiddenAccounts = new Set<string>();
  let initialCollapsedIds = new Set<string>();
  let nodes: readonly UiTreeTableNode[] = [];

  $: hiddenAccounts = $getNotShown(tree, end);
  $: initialCollapsedIds = new Set(
    getCollapsed(tree, $collapseAccount).filter(
      (account) => !hiddenAccounts.has(account),
    ),
  );
  $: nodes =
    (tree.account === ""
      ? tree.children
      : [tree]
    )
      .filter((node) => !hiddenAccounts.has(node.account))
      .map((node) => createUiNode(node, $invertAccount(node.account) ? -1 : 1));

  function createUiNode(
    source: AccountTreeNode,
    invert: number,
  ): UiTreeTableNode {
    return {
      account: source.account,
      balance: source.balance,
      balanceChildren: source.balanceChildren,
      cost: source.cost,
      costChildren: source.costChildren,
      invert,
      children: source.children
        .filter((child) => !hiddenAccounts.has(child.account))
        .map((child) => createUiNode(child, invert)),
    };
  }

  const formatBalance = (value: number, currency: string) => $ctx.num(value, currency);
  const formatAmount = (value: number, currency: string) =>
    $ctx.amount(value, currency);
  const formatDiff = (value: number, currency: string) => $ctx.num(value, currency);
</script>

<TreeTable
  {nodes}
  operatingCurrency={$operatingCurrency}
  currencyName={$currencyName}
  formatBalance={formatBalance}
  formatAmount={formatAmount}
  formatDiff={formatDiff}
  toAccountLabel={leaf}
  toAccountHref={urlForAccount}
  {hiddenAccounts}
  {initialCollapsedIds}
/>
