<script lang="ts">
  import { isEmptyRecord, type UiTreeTableNode } from "./tree-table";
  import AccountCell from "./AccountCell.svelte";
  import Diff from "./Diff.svelte";

  let {
    node,
    depth = 0,
    invert = 1,
    operatingCurrency,
    currencyName,
    collapsed,
    hiddenAccounts,
    toAccountLabel,
    toAccountHref,
    onNavigate,
    formatBalance,
    formatAmount,
    formatDiff,
    onToggle,
  }: {
    node: UiTreeTableNode;
    depth?: number;
    invert: number;
    operatingCurrency: readonly string[];
    currencyName: (currency: string) => string;
    collapsed: ReadonlySet<string>;
    hiddenAccounts: ReadonlySet<string>;
    toAccountLabel?: (account: string) => string;
    toAccountHref?: (account: string) => string;
    onNavigate?: (account: string, event: MouseEvent) => void;
    formatBalance: (value: number, currency: string) => string;
    formatAmount: (value: number, currency: string) => string;
    formatDiff: (value: number, currency: string) => string;
    onToggle: (account: string, event: MouseEvent, children: readonly UiTreeTableNode[]) => void;
  } = $props();

  const fallbackLabel = (account: string) => account;
  const defaultFormat = (value: number, currency: string) => `${value} ${currency}`;

  function accountLabel(account: string) {
    return (toAccountLabel ?? fallbackLabel)(account);
  }

  function formatter(value: number, currency: string) {
    return (formatBalance ?? defaultFormat)(value, currency);
  }

  function amountFormatter(value: number, currency: string) {
    return (formatAmount ?? defaultFormat)(value, currency);
  }

  function diffFormatter(value: number, currency: string) {
    return (formatDiff ?? defaultFormat)(value, currency);
  }

  let {
    account,
    children,
    balance,
    balanceChildren,
    cost,
    costChildren,
  } = node;

  let hasBalance = $derived(!isEmptyRecord(balance));
  let isCollapsed = $derived(collapsed.has(account));
  let shownBalance = $derived(
    isCollapsed && hasBalance ? balanceChildren : hasBalance ? balance : balanceChildren,
  );
  let shownCost = $derived(
    isCollapsed && hasBalance ? costChildren : hasBalance ? cost : costChildren,
  );
  let shownBalanceOther = $derived(
    Object.entries(shownBalance)
      .sort(([left], [right]) => left.localeCompare(right))
      .filter(([currency]) => !operatingCurrency.includes(currency)),
  );
  let dimmed = $derived(!isCollapsed && !hasBalance);
  let hasChildren = $derived(children.length > 0);
  let visibleChildren = $derived(
    children.filter((n) => !hiddenAccounts.has(n.account)),
  );

  function handleToggle(event: MouseEvent) {
    onToggle(account, event, children);
  }
</script>

<li>
  <p>
    <AccountCell
      account={account}
      accountLabel={accountLabel(account)}
      {depth}
      {hasChildren}
      {isCollapsed}
      onToggle={handleToggle}
      {children}
      {toAccountHref}
      {onNavigate}
    />
    {#each operatingCurrency as currency}
      {@const num = shownBalance[currency]}
      {@const cost_num = shownCost?.[currency] ?? 0}
      <span class="num" class:dimmed>
        {#if num}
          {formatter(invert * num, currency)}
          {#if cost_num && num - cost_num}
            {@const diff = invert * (num - cost_num)}
            <Diff
              {diff}
              num={invert * cost_num}
              {currency}
              formatAmount={amountFormatter}
              formatDiff={diffFormatter}
            />
          {/if}
        {/if}
      </span>
    {/each}
    <span class="num other" class:dimmed>
      {#each shownBalanceOther as [currentCurrency, currentBalance]}
        {@const cost_num = shownCost?.[currentCurrency] ?? 0}
        <span title={currencyName(currentCurrency)}>
          {#if currentBalance}
            {amountFormatter(invert * currentBalance, currentCurrency)}
          {:else}
            <span class="text-muted-foreground">—</span>
          {/if}
        </span>
        {#if cost_num && currentBalance - cost_num}
          {@const diff = invert * (currentBalance - cost_num)}
          <Diff
            {diff}
            num={invert * cost_num}
            currency={currentCurrency}
            formatAmount={amountFormatter}
            formatDiff={diffFormatter}
          />
        {/if}
        <br />
      {/each}
    </span>
  </p>
  {#if !isCollapsed && visibleChildren.length}
    <ol style={`--tree-closure-indent: ${depth}em;`}>
      {#each visibleChildren as child (child.account)}
        <svelte:self
          node={child}
          invert={invert}
          depth={depth + 1}
          {operatingCurrency}
          {currencyName}
          {collapsed}
          {hiddenAccounts}
          {toAccountLabel}
          {toAccountHref}
          {onNavigate}
          {formatBalance}
          {formatAmount}
          {formatDiff}
          {onToggle}
        />
      {/each}
    </ol>
  {/if}
</li>

<style>
  button {
    position: absolute;
    padding: 3px;
    color: var(--treetable-expander);
  }

  .account {
    margin-left: 1.7em;
  }

  span {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    min-width: calc(14em - var(--account-indent, 0em));
    max-width: calc(30em - var(--account-indent, 0em));
    margin-left: var(--account-indent, 0);
  }
</style>
