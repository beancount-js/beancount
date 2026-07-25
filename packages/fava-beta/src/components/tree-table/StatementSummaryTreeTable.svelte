<script lang="ts">
  import type { DateTime } from "luxon";
  import { dashboardCategoryColor } from "../dashboard/model";
  import { leaf } from "$lib/accounts";
  import { useContext } from "../../context";
  import { useCtx } from "../../stores/format";
  import { urlForAccount } from "../../helpers";
  import { getCollapsed, useGetNotShown } from "./helpers";
  import type { AccountTreeNode } from "../../lib/models";
  import { useCollapseAccount, useInvertAccount } from "../../stores/account";
  import StatementSummaryTreeTable, {
    type StatementSummaryColumn,
    type StatementSummaryContribution,
    type StatementSummaryTreeNode,
  } from "@lapis/ui/tables/StatementSummaryTreeTable.svelte";

  const { currencyName, operatingCurrency } = useContext();
  const ctx = useCtx();
  const getNotShown = useGetNotShown();
  const collapseAccount = useCollapseAccount();
  const invertAccount = useInvertAccount();

  /** The account tree to show. */
  export let tree: AccountTreeNode;
  /** Header title. */
  export let title: string;
  /** Optional link for the header. */
  export let href: string | undefined = undefined;
  /** Date cutoff to calculate closed-state visibility. */
  export let end: DateTime | null = null;
  /** Optional multiplier for value sign conventions. */
  export let multiplier = 1;

  let hiddenAccounts = new Set<string>();
  let roots: AccountTreeNode[] = [];
  let contributionNodes: AccountTreeNode[] = [];
  let contributionTotal = 0;
  let contributions: StatementSummaryContribution[] = [];
  let columns: StatementSummaryColumn[] = [];
  let nodes: StatementSummaryTreeNode[] = [];
  let initialCollapsedIds = new Set<string>();
  let primaryCurrency = "";
  let total = 0;
  let weightTotal = 0;
  let totalLabel = "—";

  $: hiddenAccounts = $getNotShown(tree, end);
  $: roots = (tree.account === "" ? tree.children : [tree]).filter(
    (node) => !hiddenAccounts.has(node.account),
  );
  $: columns = $operatingCurrency.map((currency) => ({
    id: currency,
    label: currency,
    title: $currencyName(currency),
  }));
  $: primaryCurrency =
    $operatingCurrency[0] ??
    Object.keys(tree.balanceChildren).find((currency) => currency.length > 0) ??
    "";
  $: total = roots.reduce(
    (sum, root) =>
      sum +
      (root.balanceChildren[primaryCurrency] ?? 0) *
        multiplier *
        ($invertAccount(root.account) ? -1 : 1),
    0,
  );
  $: weightTotal = roots.reduce(
    (sum, root) =>
      sum +
      directWeightTotal(
        root,
        primaryCurrency,
        multiplier,
        $invertAccount(root.account) ? -1 : 1,
      ),
    0,
  );
  $: contributionNodes = roots.flatMap((root) =>
    root.children.length ? root.children : [root],
  );
  $: contributionTotal = contributionNodes.reduce(
    (sum, node) =>
      sum +
      Math.abs(
        (node.balanceChildren[primaryCurrency] ?? 0) *
          multiplier *
          ($invertAccount(node.account) ? -1 : 1),
      ),
    0,
  );
  $: contributions = contributionTotal > 0
    ? contributionNodes
        .map((node) => {
          const amount =
            (node.balanceChildren[primaryCurrency] ?? 0) *
            multiplier *
            ($invertAccount(node.account) ? -1 : 1);
          return {
            id: node.account,
            label: node.account,
            percentage: (Math.abs(amount) / contributionTotal) * 100,
            amount: totalCurrencyAmount(amount),
            color: dashboardCategoryColor(node.account),
          };
        })
        .filter((contribution) => contribution.amount !== "—")
    : [];
  $: totalLabel = total && primaryCurrency ? $ctx.amount(total, primaryCurrency) : "—";
  $: nodes = roots.map((root) => createNode(root, $invertAccount(root.account) ? -1 : 1));
  $: initialCollapsedIds = new Set(
    getCollapsed(tree, $collapseAccount).filter(
      (account) => !hiddenAccounts.has(account),
    ),
  );

  function totalCurrencyAmount(value: number) {
    return primaryCurrency ? $ctx.amount(value, primaryCurrency) : "—";
  }

  function isEmptyRecord(values: Readonly<Record<string, number>>) {
    return Object.keys(values).length === 0;
  }

  function createNode(
    node: AccountTreeNode,
    invert: number,
  ): StatementSummaryTreeNode {
    const hasBalance = !isEmptyRecord(node.balance);
    const shownBalance = hasBalance ? node.balance : node.balanceChildren;
    const collapsedBalance = node.balanceChildren;

    const values = formatValues(shownBalance, invert, $ctx.num);
    const collapsedValues = hasBalance
      ? formatValues(collapsedBalance, invert, $ctx.num)
      : undefined;
    const otherValues = createOtherValues(shownBalance, invert, $ctx.amount);
    const collapsedOtherValues = hasBalance
      ? createOtherValues(collapsedBalance, invert, $ctx.amount)
      : undefined;

    return {
      id: node.account,
      label: leaf(node.account),
      values,
      collapsedValues,
      collapsedWeight: hasBalance ? weightFrom(collapsedBalance, invert) : undefined,
      otherValues,
      collapsedOtherValues,
      weight: weightFrom(shownBalance, invert),
      href: urlForAccount(node.account),
      color: dashboardCategoryColor(node.account),
      children: node.children
        .filter((child) => !hiddenAccounts.has(child.account))
        .map((child) => createNode(child, invert)),
    };
  }

  function weightFrom(
    values: Readonly<Record<string, number>>,
    invert: number,
  ) {
    const amount = (values[primaryCurrency] ?? 0) * multiplier * invert;
    if (!primaryCurrency || !weightTotal || !amount) return "—";
    return `${((Math.abs(amount) / weightTotal) * 100).toFixed(1)}%`;
  }

  function formatValues(
    values: Readonly<Record<string, number>>,
    invert: number,
    formatAmount: (value: number, currency: string) => string,
  ): Readonly<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const currency of $operatingCurrency) {
      const value = values[currency] ?? 0;
      if (value === 0) continue;
      result[currency] = formatAmount(value * multiplier * invert, currency);
    }
    return result;
  }

  function createOtherValues(
    values: Readonly<Record<string, number>>,
    invert: number,
    formatAmount: (value: number, currency: string) => string,
  ): readonly { label: string; value: string; title: string }[] {
    return Object.entries(values)
      .filter(
        ([currency, value]) =>
          value !== 0 && !$operatingCurrency.includes(currency),
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, value]) => ({
        label: currency,
        value: formatAmount(value * multiplier * invert, currency),
        title: $currencyName(currency),
      }));
  }

  function directWeightTotal(
    node: AccountTreeNode,
    currency: string,
    scale: number,
    invert: number,
  ): number {
    return (
      Math.abs((node.balance[currency] ?? 0) * scale * invert) +
      node.children.reduce(
        (sum: number, child: AccountTreeNode) =>
          sum + directWeightTotal(child, currency, scale, invert),
        0,
      )
    );
  }

</script>

<StatementSummaryTreeTable
  {title}
  total={totalLabel}
  {href}
  {nodes}
  {columns}
  {contributions}
  {initialCollapsedIds}
/>
