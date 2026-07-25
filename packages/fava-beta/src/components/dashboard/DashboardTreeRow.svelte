<script lang="ts">
  import DashboardTreeRow from "@lapis/ui/dashboard/DashboardTreeRow.svelte";
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
    node,
    currency,
    multiplier = 1,
    total,
    gridTemplate,
    depth = 0,
    collapsed,
    onNodeSelect = () => {},
    onToggle = () => {},
    valueFormatter = (value) => String(value),
  }: {
    node: AccountTreeNode;
    currency: string;
    multiplier?: number;
    total: number;
    gridTemplate: string;
    depth?: number;
    collapsed: ReadonlySet<string>;
    onNodeSelect?: (node: AccountTreeNode) => void;
    onToggle?: (id: string) => void;
    valueFormatter?: (value: number) => string;
  } = $props();

  const sharedNode = $derived.by(() =>
    toSharedNode(node, currency, multiplier, depth),
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

  function findNode(root: AccountTreeNode, account: string): AccountTreeNode | undefined {
    if (root.account === account) return root;
    for (const child of root.children) {
      const found = findNode(child, account);
      if (found) return found;
    }
    return undefined;
  }

  function handleNodeSelect(rowNode: SharedTreeNode) {
    const selected = findNode(node, rowNode.id);
    if (selected) onNodeSelect(selected);
  }
</script>

<DashboardTreeRow
  node={sharedNode}
  {total}
  {gridTemplate}
  {collapsed}
  {depth}
  {valueFormatter}
  onNodeSelect={handleNodeSelect}
  onToggle={onToggle}
/>
