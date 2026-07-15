<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import type { AccountTreeNode } from "../../lib/models";
  import { urlForAccount } from "../../helpers";
  import { useCtx } from "../../stores/format";
  import { dashboardCategoryColor } from "../dashboard/model";
  import { isEmpty } from "./helpers";
  import Self from "./StatementSummaryTreeRow.svelte";

  export let node: AccountTreeNode;
  export let currencies: readonly string[];
  export let primaryCurrency: string;
  export let weightTotal = 0;
  export let multiplier = 1;
  export let invert = 1;
  export let depth = 0;
  export let collapsed: ReadonlySet<string>;
  export let hiddenAccounts: ReadonlySet<string>;
  export let toggle: (account: string) => void;
  export let currencyName: (currency: string) => string;
  export let branchColor = "var(--primary)";
  export let gridTemplate: string;

  const ctx = useCtx();
  const weightBars = [0, 1, 2, 3, 4];

  $: hasChildren = node.children.length > 0;
  $: isCollapsed = collapsed.has(node.account);
  $: hasBalance = !isEmpty(node.balance);
  $: shownBalance =
    !isCollapsed && hasBalance ? node.balance : node.balanceChildren;
  $: amount = primaryCurrency ? (shownBalance[primaryCurrency] ?? 0) : 0;
  $: displayAmount = amount * multiplier * invert;
  $: weight = weightTotal ? (Math.abs(displayAmount) / weightTotal) * 100 : 0;
  $: otherBalances = Object.entries(shownBalance)
    .filter(([currency]) => !currencies.includes(currency))
    .sort(([left], [right]) => left.localeCompare(right));
  $: name = node.account.split(":").at(-1) ?? node.account;
</script>

<li>
  <div
    class="grid min-h-12 items-center border-t border-border/70 text-sm transition-colors hover:bg-muted/65"
    style={`grid-template-columns: ${gridTemplate}`}
    data-statement-summary-tree-row
  >
    <div
      class="flex min-w-0 items-center gap-1 py-2 pr-4"
      style={`padding-left: ${0.9 + depth * 1.2}rem`}
    >
      {#if hasChildren}
        <button
          type="button"
          class="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.account}`}
          aria-expanded={!isCollapsed}
          onclick={() => toggle(node.account)}
        >
          <ChevronDown
            class={`size-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
          />
        </button>
      {:else}
        <span class="size-4 shrink-0" aria-hidden="true"></span>
      {/if}
      <a
        class="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
        href={urlForAccount(node.account)}
        title={node.account}>{name}</a
      >
    </div>
    <span
      class:dimmed={!displayAmount}
      class="grid grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-3 px-4 text-right font-mono text-[13px] tabular-nums"
    >
      <span
        class:invisible={!displayAmount}
        class="weight-meter justify-self-start"
        style={`--meter-color: ${branchColor}`}
        data-statement-weight-meter
        aria-hidden="true"
      >
        {#each weightBars as bar}
          <span style={`opacity: ${0.48 + bar * 0.11}`}></span>
        {/each}
      </span>
      <span class="justify-self-end" data-statement-weight
        >{displayAmount ? `${weight.toFixed(1)}%` : "—"}</span
      >
    </span>
    {#each currencies as currency}
      {@const value = (shownBalance[currency] ?? 0) * multiplier * invert}
      <span
        class:dimmed={!value}
        class="px-4 text-right font-mono text-[13px] tabular-nums"
      >
        {value ? $ctx.num(value, currency) : "—"}
      </span>
    {/each}
    <span
      class:dimmed={!otherBalances.length}
      class="px-4 py-2 text-right font-mono text-[13px] tabular-nums"
    >
      {#each otherBalances as [currency, value]}
        <span class="block" title={currencyName(currency)}
          >{$ctx.amount(value * multiplier * invert, currency)}</span
        >
      {:else}
        —
      {/each}
    </span>
  </div>
  {#if hasChildren && !isCollapsed}
    <ol>
      {#each node.children.filter((child) => !hiddenAccounts.has(child.account)) as child (child.account)}
        <Self
          {currencies}
          {primaryCurrency}
          {weightTotal}
          {multiplier}
          {invert}
          node={child}
          depth={depth + 1}
          {collapsed}
          {hiddenAccounts}
          {toggle}
          {currencyName}
          branchColor={depth === 0
            ? dashboardCategoryColor(child.account)
            : branchColor}
          {gridTemplate}
        />
      {/each}
    </ol>
  {/if}
</li>

<style>
  .dimmed {
    color: var(--muted-foreground);
  }

  .weight-meter {
    display: grid;
    grid-template-columns: repeat(5, 0.22rem);
    gap: 0.14rem;
    height: 0.85rem;
    align-items: stretch;
    color: var(--meter-color);
  }

  .weight-meter > span {
    border-radius: 999px;
    background: currentColor;
  }
</style>
