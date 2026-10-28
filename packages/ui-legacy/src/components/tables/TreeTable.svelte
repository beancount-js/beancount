<script lang="ts">
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import type { UiTreeTableNode } from "./tree-table";
  import AccountCellHeader from "./AccountCellHeader.svelte";
  import TreeTableNode from "./TreeTableNode.svelte";
  import { collectCollapsibleNodeIds } from "./tree-table";

  let {
    nodes,
    operatingCurrency,
    currencyName,
    formatBalance,
    formatAmount,
    formatDiff,
    toAccountLabel,
    toAccountHref,
    onNavigate,
    hiddenAccounts = new Set<string>(),
    initialCollapsedIds = new Set<string>(),
    ariaLabel = "Account hierarchy",
  }: {
    nodes: readonly UiTreeTableNode[];
    operatingCurrency: readonly string[];
    currencyName: (currency: string) => string;
    formatBalance?: (value: number, currency: string) => string;
    formatAmount?: (value: number, currency: string) => string;
    formatDiff?: (value: number, currency: string) => string;
    toAccountLabel: (account: string) => string;
    toAccountHref?: (account: string) => string;
    onNavigate?: (account: string, event: MouseEvent) => void;
    hiddenAccounts?: ReadonlySet<string>;
    initialCollapsedIds?: ReadonlySet<string>;
    ariaLabel?: string;
  } = $props();

  let collapsedIds = $state(new Set<string>());
  let hasAppliedInitialCollapsedIds = false;
  const fallbackCurrencyFormatter = (value: number, currency: string) =>
    `${value} ${currency}`;

  function balanceFormatter(value: number, currency: string) {
    return (formatBalance ?? fallbackCurrencyFormatter)(value, currency);
  }

  function otherFormatter(value: number, currency: string) {
    return (formatAmount ?? fallbackCurrencyFormatter)(value, currency);
  }

  function diffFormatter(value: number, currency: string) {
    return (formatDiff ?? fallbackCurrencyFormatter)(value, currency);
  }

  $effect.pre(() => {
    if (hasAppliedInitialCollapsedIds) return;
    collapsedIds = new Set(initialCollapsedIds);
    hasAppliedInitialCollapsedIds = true;
  });

  const collapsibleIds = $derived(collectCollapsibleNodeIds(nodes));
  const allCollapsed = $derived(
    collapsibleIds.length > 0 &&
      collapsibleIds.every((id) => collapsedIds.has(id)),
  );
  const visibleNodes = $derived(
    nodes.filter((node) => !hiddenAccounts.has(node.account)),
  );
  const isWider = $derived(operatingCurrency.length > 1);

  function toggle(
    account: string,
    event: MouseEvent,
    children: readonly UiTreeTableNode[],
  ) {
    const next = new Set(collapsedIds);
    const isCollapsed = next.has(account);
    if (isCollapsed) {
      next.delete(account);
    } else {
      next.add(account);
    }

    if (event.shiftKey) {
      const toggleAll = (child: UiTreeTableNode) => {
        if (isCollapsed) {
          next.delete(child.account);
        } else {
          next.add(child.account);
        }
        child.children
          .filter((childNode) => childNode.children.length)
          .forEach(toggleAll);
      };
      children.forEach(toggleAll);
    }

    if (isCollapsed && (event.ctrlKey || event.metaKey)) {
      children
        .filter((child) => child.children.length)
        .forEach((child) => {
          next.add(child.account);
        });
    }

    collapsedIds = next;
  }

  function toggleAll() {
    collapsedIds = allCollapsed ? new Set() : new Set(collapsibleIds);
  }
</script>

<ol
  class="cn-tables-treetable-109-1 tree-table-new hierarchy-tree-table statement-tree-table"
  class:wider={isWider}
  data-statement-tree-table
  aria-label={ariaLabel}
>
  <li class="head">
    <p>
      <AccountCellHeader
        hasCollapsed={collapsedIds.size > 0}
        onToggleAll={toggleAll}
      />
      {#each operatingCurrency as currency}
        <span class="num" title={currencyName(currency)}>{currency}</span>
      {/each}
      <span class="num other">Other</span>
    </p>
  </li>
  {#each visibleNodes as node (node.account)}
    <TreeTableNode
      {node}
      invert={node.invert ?? 1}
      depth={0}
      {operatingCurrency}
      {currencyName}
      collapsed={collapsedIds}
      {hiddenAccounts}
      {toAccountLabel}
      {toAccountHref}
      {onNavigate}
      formatBalance={balanceFormatter}
      formatAmount={otherFormatter}
      formatDiff={diffFormatter}
      onToggle={toggle}
    />
  {/each}
</ol>
<div class="cn-tables-treetable-145-1"></div>

<style>
  :global(.tree-table-new p) {
    margin-top: -1px;
  }

  :global(.tree-table-new p > span) {
    margin-right: -1px;
    margin-top: -1px;
    border: 1px solid var(--table-border-color);
  }

  :global(.tree-table-new .num) {
    width: 9em;
  }

  :global(.tree-table-new .other) {
    width: 12em;
  }

  :global(.hierarchy-tree-table) {
    --treetable-expander: var(--muted-foreground);
    font-size: 0.875rem;
  }

  :global(.hierarchy-tree-table.tree-table-new p) {
    margin-top: 0;
  }

  :global(.hierarchy-tree-table.tree-table-new p > span) {
    margin-top: 0;
    margin-right: -1px;
    border: 1px solid var(--border) !important;
    border-width: 0 1px 1px !important;
  }

  :global(.hierarchy-tree-table li > ol) {
    position: relative;
  }

  :global(.hierarchy-tree-table li > ol::after) {
    position: absolute;
    bottom: 0;
    left: var(--tree-closure-indent);
    width: 1em;
    height: 1px;
    pointer-events: none;
    content: "";
    background-color: var(--border);
  }

  :global(.hierarchy-tree-table li > p > span:first-child) {
    position: sticky;
    left: 0;
    z-index: 1;
    background-color: var(--background);
  }

  :global(.hierarchy-tree-table li > p > span[data-account-name]) {
    left: var(--account-indent, 0);
    box-shadow: calc(-1 * var(--account-indent, 0)) 0 0 0 var(--background);
  }

  :global(.hierarchy-tree-table.flex-table .head p > span) {
    font-family: inherit;
    color: var(--muted-foreground);
    background-color: var(--muted);
    border-width: 1px !important;
  }

  :global(.hierarchy-tree-table.flex-table .head p > span:first-child) {
    z-index: 2;
  }

  :global(.hierarchy-tree-table .clickable-icon svg) {
    width: 12px;
    height: 12px;
  }

  :global(.two-currencies) {
    font-size: 0.9em;
  }

  :global(.two-currencies .num) {
    width: 8em;
  }

  :global(.two-currencies .other) {
    width: 11em;
  }

  :global(.statement-tree-table) {
    list-style: none;
    margin: 0;
    padding: 0;
  }
</style>
