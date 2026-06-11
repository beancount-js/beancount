<script lang="ts">
    import { useContext } from "../../context";
    import type { AccountBudget, AccountTreeNode } from "../../core/account";
    import { useCtx } from "../../stores/format";

    const { currencyName } = useContext();
    const ctx = useCtx();
  
    import AccountCell from "./AccountCell.svelte";
    import Diff from "./Diff.svelte";
    import { getTreeTableContext, isEmpty } from "./helpers";
  
    /** The account nodes to show. */
    export let nodes: ReadonlyArray<AccountTreeNode>;
    /** The budgets (per account a list per date range). */
    export let budgets: Record<string, AccountBudget[]>;
  
    const { toggled, notShown } = getTreeTableContext();

    $: [node] = nodes;
    $: ({ account, children } = node);
    $: accountBudgets = budgets[account];
  
    $: isToggled = $toggled.has(account);
  </script>
  
  <li>
    <p>
      <AccountCell {node} />
      {#each nodes as n, index}
        {@const accountBudget = accountBudgets?.[index]}
        {@const hasBalance =
          !isEmpty(n.balance) ||
          (accountBudget != null && !isEmpty(accountBudget.budget))}
        {@const showBalance = !isToggled && hasBalance}
        {@const shownBalance = showBalance ? n.balance : n.balanceChildren}
        {@const shownBudget = showBalance
          ? accountBudget?.budget
          : accountBudget?.budgetChildren}
        <span class="num other" class:dimmed={!isToggled && !hasBalance}>
          {#each Object.entries(shownBalance) as [currency, number]}
            {@const budget = shownBudget?.[currency]}
            <span title={$currencyName(currency)}>
              {$ctx.amount(number, currency)}
            </span>
            {#if budget}
              <Diff diff={budget - number} num={budget} {currency} />
            {/if}
            <br />
          {/each}
          {#if shownBudget}
            {#each Object.entries(shownBudget).filter(([c]) => !(shownBalance[c] ?? 0)) as [currency, budget]}
              <span title={$currencyName(currency)}>
                {$ctx.amount(0, currency)}
              </span>
              <Diff diff={budget} num={budget} {currency} />
              <br />
            {/each}
          {/if}
        </span>
      {/each}
    </p>
    {#if !isToggled && children.some((n) => !$notShown.has(n.account))}
      <ol>
        {#each children as child, index (child.account)}
          {#if !$notShown.has(child.account)}
            <svelte:self nodes={nodes.map((n) => n.children[index] || {})} {budgets} />
          {/if}
        {/each}
      </ol>
    {/if}
  </li>