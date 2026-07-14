<script lang="ts">
  import { intersection, min } from "d3-array";
  import { writable } from "svelte/store";

  import { urlForAccount } from "../../helpers";
  import { useCurrentTimeFilterDateFormat } from "../../stores/format";

  import AccountCellHeader from "./AccountCellHeader.svelte";
  import {
    getCollapsed,
    useGetNotShown,
    setTreeTableContext,
    getAllNodes,
  } from "./helpers";

  import type { AccountTreeNode, AccountBudget } from "../../core/account";
  import IntervalTreeTableNode from "./IntervalTreeTableNode.svelte";
  import type { DateRange } from "@beancount-js/filters";
  import { useCollapseAccount } from "../../stores/account";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
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
  // Initialize context.
  // toggled is computed once on initialisation; not_shown is kept updated.
  const toggled = writable(getCollapsed(trees[0], $collapseAccount));
  const notShown = writable(new Set<string>());
  setTreeTableContext({
    toggled,
    notShown,
    collapseAll: () => {
      toggled.set(getAllNodes(trees[0]));
    },
  });

  $: $notShown = intersection(
    ...trees.map((n: AccountTreeNode, index: number) =>
      $getNotShown(n, dates[index]?.to ?? null),
    ),
  );

  $: account = trees[0].account;
  $: startDate = accumulate ? min(dates, (d) => d.from) : undefined;
  $: startDateFilter = startDate
    ? $currentTimeFilterDateFormat(startDate)
    : undefined;
  $: time_filters = dates.map((dateRange): [string, string] => {
    const title = $currentTimeFilterDateFormat(dateRange.from);
    return startDateFilter != null
      ? [title, `${startDateFilter}-${title}`]
      : [title, title];
  });
</script>

<ScrollArea.Root orientation="horizontal" class="w-full max-w-full">
  <ol class="flex-table tree-table-new pb-8">
    <li class="head">
      <p>
        <AccountCellHeader />
        {#each time_filters as [title, time]}
          <span class="num other">
            <a href={urlForAccount(account, { time })}>
              {title}
            </a>
          </span>
        {/each}
      </p>
    </li>
    <IntervalTreeTableNode nodes={trees} {budgets} />
  </ol>
</ScrollArea.Root>
