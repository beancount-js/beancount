<script lang="ts">
  import { intersection, min } from "d3-array";
  import { leaf } from "$lib/accounts";
  import AccountLink from "../AccountLink.svelte";
  import UiIntervalTreeTable, {
    type IntervalTreeAmount,
    type IntervalTreeCell,
    type IntervalTreeColumn,
    type IntervalTreeNode,
  } from "@lapis/ui/tables/IntervalTreeTable.svelte";
  import { urlForAccount } from "../../helpers";
  import { useCurrentTimeFilterDateFormat } from "../../stores/format";
  import { getCollapsed, useGetNotShown, isEmpty } from "./helpers";
  import type { AccountTreeNode, AccountBudget } from "../../core/account";
  import type { DateRange } from "@beancount-js/filters";
  import { useCollapseAccount } from "../../stores/account";
  import { useContext } from "../../context";
  import { useCtx } from "../../stores/format";

  const { currencyName } = useContext();
  const ctx = useCtx();
  const getNotShown = useGetNotShown();
  const currentTimeFilterDateFormat = useCurrentTimeFilterDateFormat();

  /** The account trees to show. */
  export let trees: ReadonlyArray<AccountTreeNode>;
  /** The dates. */
  export let dates: DateRange[];
  /** The budgets (per account a list per date range). */
  export let budgets: Record<string, AccountBudget[]>;
  /** Whether this is cumulative. */
  export let accumulate: boolean;

  const collapseAccount = useCollapseAccount();

  $: hiddenAccounts =
    trees.length > 0
      ? (intersection(
          ...trees.map((node: AccountTreeNode, index: number) =>
            $getNotShown(node, dates[index]?.to ?? null),
          ),
        ) ?? new Set<string>())
      : new Set<string>();
  $: account = trees[0]?.account ?? "";
  $: startDate = accumulate ? min(dates, (d) => d.from) : undefined;
  $: startDateFilter = startDate
    ? $currentTimeFilterDateFormat(startDate)
    : undefined;
  $: columns = dates.map((dateRange): IntervalTreeColumn => {
    const label = $currentTimeFilterDateFormat(dateRange.from);
    return startDateFilter != null
      ? {
          id: dateRange.from.toISO() ?? label,
          label,
          href: urlForAccount(account, {
            time: `${startDateFilter}-${label}`,
          }),
        }
      : {
          id: dateRange.from.toISO() ?? label,
          label,
          href: urlForAccount(account, { time: label }),
        };
  });
  $: nodes = createNodes(trees, budgets, hiddenAccounts);
  $: initialCollapsedIds = trees[0]
    ? getCollapsed(trees[0], $collapseAccount)
    : new Set<string>();
  $: tableKey = `${account}:${columns.map((column) => column.id).join("|")}`;

  function formatAmounts(
    balance: Record<string, number>,
    budget: Record<string, number> | undefined,
  ): IntervalTreeAmount[] {
    const amounts = Object.entries(balance).map(([currency, number]) => {
      const expected = budget?.[currency];
      return {
        value: $ctx.amount(number, currency),
        title: $currencyName(currency),
        difference: expected
          ? {
              value: `(${$ctx.num(expected - number, currency)})`,
              title: $ctx.amount(expected, currency),
              tone: expected - number > 0 ? "positive" : "negative",
            }
          : undefined,
      } satisfies IntervalTreeAmount;
    });

    for (const [currency, expected] of Object.entries(budget ?? {})) {
      if (balance[currency] ?? 0) continue;
      amounts.push({
        value: $ctx.amount(0, currency),
        title: $currencyName(currency),
        difference: expected
          ? {
              value: `(${$ctx.num(expected, currency)})`,
              title: $ctx.amount(expected, currency),
              tone: expected > 0 ? "positive" : "negative",
            }
          : undefined,
      });
    }

    return amounts;
  }

  function createCell(
    node: AccountTreeNode | undefined,
    budget: AccountBudget | undefined,
  ): IntervalTreeCell {
    const balance = node?.balance ?? {};
    const balanceChildren = node?.balanceChildren ?? {};
    const hasBalance = !isEmpty(balance) || !isEmpty(budget?.budget ?? {});
    const descendantValues = formatAmounts(
      balanceChildren,
      budget?.budgetChildren,
    );
    return {
      values: hasBalance
        ? formatAmounts(balance, budget?.budget)
        : descendantValues,
      collapsedValues: descendantValues,
      dimmed: !hasBalance,
      collapsedDimmed: false,
    };
  }

  function findChild(
    node: AccountTreeNode | undefined,
    account: string,
  ): AccountTreeNode | undefined {
    return node?.children.find((child) => child.account === account);
  }

  function createNode(
    periodNodes: ReadonlyArray<AccountTreeNode | undefined>,
    budgetByAccount: Record<string, AccountBudget[]>,
    hidden: ReadonlySet<string>,
  ): IntervalTreeNode {
    const node = periodNodes[0]!;
    return {
      id: node.account,
      label: leaf(node.account),
      href: urlForAccount(node.account),
      cells: Object.fromEntries(
        periodNodes.map((periodNode, index) => [
          columns[index]!.id,
          createCell(periodNode, budgetByAccount[node.account]?.[index]),
        ]),
      ),
      children: node.children
        .filter((child) => !hidden.has(child.account))
        .map((child) =>
          createNode(
            periodNodes.map((periodNode) =>
              findChild(periodNode, child.account),
            ),
            budgetByAccount,
            hidden,
          ),
        ),
    };
  }

  function createNodes(
    periodTrees: ReadonlyArray<AccountTreeNode>,
    budgetByAccount: Record<string, AccountBudget[]>,
    hidden: ReadonlySet<string>,
  ): IntervalTreeNode[] {
    if (!periodTrees.length) return [];
    const [firstTree] = periodTrees;
    const roots = firstTree.account === "" ? firstTree.children : [firstTree];
    return roots.map((root) =>
      createNode(
        periodTrees.map((tree) =>
          tree.account === "" ? findChild(tree, root.account) : tree,
        ),
        budgetByAccount,
        hidden,
      ),
    );
  }
</script>

{#snippet accountCell(node: IntervalTreeNode)}
  <AccountLink account={node.id} label={node.label} avatarSize="sm" />
{/snippet}

{#key tableKey}
  <UiIntervalTreeTable
    {nodes}
    {columns}
    {initialCollapsedIds}
    {accountCell}
    ariaLabel={`${accumulate ? "Cumulative" : "Period"} account comparison`}
  />
{/key}
