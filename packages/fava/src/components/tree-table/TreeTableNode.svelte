<script lang="ts">
  import type { AccountTreeNode } from "../../lib/models";

  import AccountCell from "./AccountCell.svelte";
  import Diff from "./Diff.svelte";
  import { getTreeTableContext, isEmpty } from "./helpers";
  import { useCtx } from "../../stores/format";
  import { useContext } from "../../context";
  import Self from "./TreeTableNode.svelte";

  const { currencyName, operatingCurrency } = useContext();
  const ctx = useCtx();

  /** The account node to show. */
  export let node: AccountTreeNode;
  /** Whether to invert all numbers (either `1` or `-1`). */
  export let invert: number;

  const { toggled, notShown } = getTreeTableContext();

  $: ({ account, children } = node);

  $: isToggled = $toggled.has(account);

  $: hasBalance = !isEmpty(node.balance);
  $: showBalance = !isToggled && hasBalance;
  $: shownBalance = showBalance ? node.balance : node.balanceChildren;
  $: shownCost = showBalance ? node.cost : node.costChildren;
  $: shownBalanceOther = Object.entries(shownBalance)
    .sort()
    .filter(([c]) => !$operatingCurrency.includes(c));
  $: dimmed = !isToggled && !hasBalance;
</script>

<li>
  <p>
    <AccountCell {node} />
    {#each $operatingCurrency as currency}
      {@const num = shownBalance[currency]}
      {@const cost_num = shownCost?.[currency] ?? 0}
      <span class="num" class:dimmed>
        {#if num}
          {$ctx.num(invert * num, currency)}
          {#if cost_num && num - cost_num}
            {@const diff = invert * (num - cost_num)}
            <Diff {diff} num={invert * cost_num} {currency} />
          {/if}
        {/if}
      </span>
    {/each}
    <span class="num other" class:dimmed>
      {#each shownBalanceOther as [currency, num]}
        {@const cost_num = shownCost?.[currency] ?? 0}
        <span title={$currencyName(currency)}>
          {$ctx.amount(invert * num, currency)}
        </span>
        {#if cost_num && num - cost_num}
          {@const diff = invert * (num - cost_num)}
          <Diff {diff} num={invert * cost_num} {currency} />
        {/if}
        <br />
      {/each}
    </span>
  </p>
  {#if !isToggled && children.some((n) => !$notShown.has(n.account))}
    <ol>
      {#each children.filter((n) => !$notShown.has(n.account)) as child (child.account)}
        <Self node={child} {invert} />
      {/each}
    </ol>
  {/if}
</li>
