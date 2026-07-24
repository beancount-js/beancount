<script lang="ts">
  import type { DateTime } from "luxon";
  import { writable } from "svelte/store";
  import { useCollapseAccount, useInvertAccount } from "../../stores/account";
  import type { AccountTreeNode } from "../../lib/models";
  import {
    getAllNodes,
    getCollapsed,
    setTreeTableContext,
    useGetNotShown,
  } from "./helpers";

  import TreeTableNode from "./TreeTableNode.svelte";
  import AccountCellHeader from "./AccountCellHeader.svelte";
  import { useContext } from "../../context";

  const { currencyName, operatingCurrency } = useContext();
  const getNotShown = useGetNotShown();

  /** The account tree to show. */
  export let tree: AccountTreeNode;
  /** The end date (for closed accounts). */
  export let end: DateTime | null;

  const collapseAccount = useCollapseAccount();
  const invertAccount = useInvertAccount();
  const toggled = writable(getCollapsed(tree, $collapseAccount));
  const notShown = writable(new Set<string>());
  setTreeTableContext({
    toggled,
    notShown,
    collapseAll: () => {
      toggled.set(getAllNodes(tree));
    },
  });
  $: $notShown = $getNotShown(tree, end);
</script>

<ol
  class="flex-table tree-table-new hierarchy-tree-table statement-tree-table font-mono text-sm text-foreground"
  class:wider={$operatingCurrency.length > 1}
  data-statement-tree-table
>
  <li class="head">
    <p>
      <AccountCellHeader />
      {#each $operatingCurrency as currency}
        <span class="num" title={$currencyName(currency)}>{currency}</span>
      {/each}
      <span class="num other">{"Other"}</span>
    </p>
  </li>
  {#each tree.account === "" ? tree.children : [tree] as n}
    <TreeTableNode node={n} invert={$invertAccount(n.account) ? -1 : 1} />
  {/each}
</ol>
<div class="p-2"></div>

<style>
  .wider {
    font-size: 0.9em;
  }
</style>
