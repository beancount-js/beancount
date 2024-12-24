<script lang="ts">
  import { isEmpty } from "lodash";
  import { useLedger } from "../../context/ledger.svelte";
  import { useTreeTable, type AccountTreeNode } from "./state.svelte";
  import AccountCell from "./AccountCell.svelte";
  import Self from "./TreeTableNode.svelte";
  import Diff from "./Diff.svelte";
  import { cn } from "$lib/utils";
  const ledger = useLedger();
  const treeState = useTreeTable();
  type Props = {
    /** The account tree to show. */
    node: AccountTreeNode;
    /** Whether to invert all numbers (either `1` or `-1`). */
    invert: number;
  };
  let { node, invert }: Props = $props();
  let isToggled = $derived(treeState.isToggled(node.account));
  let hasBalance = $derived(!isEmpty(node.balance));
  let showBalance = $derived(!isToggled && hasBalance);
  let shownBalance = $derived(
    showBalance ? node.balance : node.balanceChildren,
  );
  let shownCost = $derived(showBalance ? node.cost : node.costChildren);
  let shownBalanceOther = $derived.by(() => {
    return Object.entries(shownBalance)
      .sort()
      .filter(([c]) => !ledger.operatingCurrency.includes(c));
  });
  let dimmed = $derived(!isToggled && !hasBalance);
</script>

<li class="">
  <p class="group">
    <AccountCell {node} />
    {#each ledger.operatingCurrency as currency}
      {@const num = shownBalance[currency]}
      {@const cost_num = shownCost?.[currency] ?? 0}
      <span class={cn("group-hover:bg-muted/50 num border", {"text-muted-foreground": dimmed})}>
        {#if num}
          {ledger.formatter.num(invert * num, currency)}
          {#if cost_num && num - cost_num}
            {@const diff = invert * (num - cost_num)}
            <Diff {diff} num={invert * cost_num} {currency} />
          {/if}
        {/if}
      </span>
    {/each}
    <span class={cn("group-hover:bg-muted/50 num other border", {"text-muted-foreground": dimmed})}>
      {#each shownBalanceOther as [currency, num]}
        {@const cost_num = shownCost?.[currency] ?? 0}
        <span title={ledger.currencyName(currency)}>
          {ledger.formatter.amount(invert * num, currency)}
        </span>
        {#if cost_num && num - cost_num}
          {@const diff = invert * (num - cost_num)}
          <Diff {diff} num={invert * cost_num} {currency} />
        {/if}
        <br />
      {/each}
    </span>
  </p>
  {#if !isToggled && node.children.some((n) => !treeState.notShown.has(n.account))}
    <ol>
      {#each node.children.filter((n) => !treeState.notShown.has(n.account)) as child (child.account)}
        <Self node={child} {invert} />
      {/each}
    </ol>
  {/if}
</li>
