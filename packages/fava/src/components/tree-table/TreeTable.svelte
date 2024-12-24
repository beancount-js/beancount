<script lang="ts">
  import AccountCellHeader from "./AccountCellHeader.svelte";
  import type { DateTime } from "luxon";
  import "./tree-table.css";
  import {
    getAllNodes,
    getCollapsed,
    setTreeTableContext,
    type AccountTreeNode,
  } from "./state.svelte";
  import { useLedger } from "../../context/ledger.svelte";
  import TreeTableNode from "./TreeTableNode.svelte";
  const ledger = useLedger();

  type Props = {
    /** The account tree to show. */
    tree: AccountTreeNode;
    /** The end date (for closed accounts). */
    end: DateTime | null;
  };
  let { tree, end }: Props = $props();
  const treeState = setTreeTableContext({
    nodes() {
      return [...getAllNodes(tree)];
    },
  });
  treeState.toggled = getCollapsed(tree, ledger.collapseAccount);
  treeState.notShown = ledger.notShown(tree, end);
</script>

<ol
  class="flex-table tree-table-new font-mono text-sm text-foreground"
  class:wider={ledger.operatingCurrency.length > 1}
>
  <li class="head">
    <p class="group">
      <AccountCellHeader />
      {#each ledger.operatingCurrency as currency}
        <span class="group-hover:bg-muted/50 num border font-medium" title={ledger.currencyName(currency)}>{currency}</span>
      {/each}
      <span class="group-hover:bg-muted/50 num other border font-medium">{"Other"}</span>
    </p>
  </li>
  {#each tree.account === "" ? tree.children : [tree] as n}
    <TreeTableNode node={n} invert={ledger.invertAccount(n.account) ? -1 : 1} />
  {/each}
</ol>
<div class="p-2"></div>

<style>
  /* For two or more operating currencies, set a slightly smaller size. */
  .wider {
    font-size: 0.9em;
  }
</style>
