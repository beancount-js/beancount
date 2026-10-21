<script lang="ts">
  import AccountLink from "../AccountLink.svelte";
  import { leaf } from "../../lib/accounts";
  import type { AccountTreeNode } from "../../lib/models";
  import { getTreeTableContext } from "./helpers";

  const { toggled } = getTreeTableContext();

  /** The account node to render the name cell for. */
  export let node: AccountTreeNode;
  /** The account's depth in the rendered hierarchy. */
  export let depth = 0;
  let account: string;
  let children: AccountTreeNode[];
  $: ({ account, children } = node);

  function handleClick(event: MouseEvent) {
    toggled.update((t) => {
      const newSet = new Set(t);
      const isToggled = newSet.has(account);
      if (isToggled) {
        newSet.delete(account);
      } else {
        newSet.add(account);
      }
      if (event.shiftKey) {
        const toggleAll = (n: AccountTreeNode) => {
          if (isToggled) {
            newSet.delete(n.account);
          } else {
            newSet.add(n.account);
          }
          n.children
            .filter((c: AccountTreeNode) => c.children.length)
            .forEach(toggleAll);
        };
        children.forEach(toggleAll);
      }
      if (isToggled && (event.ctrlKey || event.metaKey)) {
        children
          .filter((c) => c.children.length)
          .forEach((n) => {
            newSet.add(n.account);
          });
      }
      return newSet;
    });
  }
</script>

<span
  class="droptarget"
  data-account-name={account}
  style={`--account-indent: ${depth}em;`}
>
  {#if children.length > 0}
    <button
      type="button"
      class="clickable-icon"
      aria-label={`${$toggled.has(account) ? "Expand" : "Collapse"} ${account}`}
      aria-expanded={!$toggled.has(account)}
      on:click={handleClick}
    >
      {#if $toggled.has(account)}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6" /></svg
        >
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6" /></svg
        >
      {/if}
    </button>
  {/if}
  <span class="account"><AccountLink {account} label={leaf(account)} /></span>
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
