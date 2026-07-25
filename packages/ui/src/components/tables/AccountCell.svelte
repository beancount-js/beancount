<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import type { UiTreeTableNode } from "./tree-table";

  let {
    account,
    accountLabel,
    depth = 0,
    hasChildren,
    isCollapsed,
    onToggle,
    children = [],
    toAccountHref,
    onNavigate,
  }: {
    account: string;
    accountLabel: string;
    depth?: number;
    hasChildren: boolean;
    isCollapsed: boolean;
    children?: readonly UiTreeTableNode[];
    onToggle: (event: MouseEvent, children: readonly UiTreeTableNode[]) => void;
    toAccountHref?: (account: string) => string;
    onNavigate?: (account: string, event: MouseEvent) => void;
  } = $props();

  const childlessClasses = "size-4 shrink-0";

  function handleClick(event: MouseEvent) {
    event.preventDefault();
    onToggle(event, children);
  }

  function navigate(event: MouseEvent) {
    if (!toAccountHref) return;
    if (onNavigate) event.preventDefault();
    onNavigate?.(account, event);
  }

  const label = $derived(`${accountLabel}`);
  const href = $derived(toAccountHref?.(account));
</script>

<span
  class="droptarget"
  data-account-name={account}
  style={`--account-indent: ${depth}em;`}
>
  {#if hasChildren}
    <button
      type="button"
      class="clickable-icon"
      aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${account}`}
      onclick={handleClick}
    >
      {#if isCollapsed}
        <ChevronRight
          class="h-3 w-3"
          aria-hidden="true"
        />
      {:else}
        <ChevronDown
          class="h-3 w-3"
          aria-hidden="true"
        />
      {/if}
    </button>
  {:else}
    <span class={childlessClasses} aria-hidden="true"></span>
  {/if}
  <span class="account">
    {#if href}
      <a href={href} onclick={navigate}>{label}</a>
    {:else}
      {label}
    {/if}
  </span>
</span>

<style>
  button {
    position: absolute;
    padding: 3px;
    color: var(--treetable-expander);
  }

  .account {
    margin-left: 1.7em;
  }

  .account a {
    color: var(--primary);
    text-decoration: none;
  }

  .account a:hover {
    text-decoration: underline;
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
