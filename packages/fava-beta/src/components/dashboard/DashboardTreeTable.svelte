<script lang="ts">
  import { urlForAccount } from "../../helpers";
  import DashboardTreeTable from "@beancount-js/ui/dashboard/DashboardTreeTable.svelte";
  import { dashboardCategoryColor } from "./model";
  import type { AccountTreeNode } from "../../lib/models";

  interface SharedTreeNode {
    id: string;
    label: string;
    value: number;
    color?: string;
    children?: readonly SharedTreeNode[];
  }

  let {
    tree,
    title,
    href,
    currency,
    multiplier = 1,
    formatter = (value) => String(value),
    onNodeSelect = () => {},
  }: {
    tree: AccountTreeNode;
    title: string;
    href: string;
    currency: string;
    multiplier?: number;
    formatter?: (value: number, currency: string) => string;
    onNodeSelect?: (node: AccountTreeNode) => void;
  } = $props();

  const roots = $derived(
    tree.account === "" ? tree.children : [tree],
  );

  function nodeLabel(account: string) {
    return account.split(":").at(-1) ?? account;
  }

  function branchColorForChild(
    child: AccountTreeNode,
    depthLevel: number,
    inheritedColor: string,
  ) {
    if (depthLevel === 0) return dashboardCategoryColor(child.account);
    return inheritedColor;
  }

  function toSharedNode(
    source: AccountTreeNode,
    currencyCode: string,
    scale: number,
    depthLevel: number,
    inheritedColor = "var(--primary)",
  ): SharedTreeNode {
    const value =
      (Number.isFinite(source.balanceChildren[currencyCode] ?? NaN)
        ? source.balanceChildren[currencyCode] ?? 0
        : 0) * scale;

    const children = source.children.map((child) =>
      toSharedNode(
        child,
        currencyCode,
        scale,
        depthLevel + 1,
        branchColorForChild(child, depthLevel, inheritedColor),
      ),
    );

    return {
      id: source.account,
      label: nodeLabel(source.account),
      value,
      color: depthLevel === 0 ? undefined : inheritedColor,
      children: children.length ? children : undefined,
    };
  }

  const nodes = $derived(
    roots.map((root) => toSharedNode(root, currency, multiplier, 0)),
  );

  function findNode(root: AccountTreeNode, account: string): AccountTreeNode | undefined {
    if (root.account === account) return root;

    for (const child of root.children) {
      const match = findNode(child, account);
      if (match) return match;
    }

    return undefined;
  }

  function handleNodeSelect(node: SharedTreeNode) {
    const selected = findNode(tree, node.id);
    if (!selected) return;

    onNodeSelect(selected);
    if (selected.account) {
      window.location.href = urlForAccount(selected.account);
    }
  }

  function handleViewAll() {
    window.location.href = href;
  }
</script>

<DashboardTreeTable
  {nodes}
  {title}
  ariaLabel={`${title} account hierarchy`}
  emptyLabel="No accounts match this period."
  viewAllLabel="View account"
  valueFormatter={(value) => formatter(value, currency)}
  onNodeSelect={handleNodeSelect}
  onViewAll={handleViewAll}
/>
