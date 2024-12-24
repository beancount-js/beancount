<script lang="ts">
  import { leaf } from "$lib/accounts";
  import { urlForAccount } from "../../helpers";
  import { useTreeTable, type AccountTreeNode } from "./state.svelte";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import Button from "$lib/components/ui/button/button.svelte";

  const treeState = useTreeTable();

  let { node }: { node: AccountTreeNode } = $props();

  function handleClick(event: MouseEvent) {
    const newSet = new Set(treeState.toggled);
    const isToggled = newSet.has(node.account);
    if (isToggled) {
      newSet.delete(node.account);
    } else {
      newSet.add(node.account);
    }

    if (event.shiftKey) {
      // toggle all children as well.
      const toggleAll = (n: AccountTreeNode) => {
        if (isToggled) {
          newSet.delete(n.account);
        } else {
          newSet.add(n.account);
        }
        n.children.filter((c) => c.children.length).forEach(toggleAll);
      };
      node.children.forEach(toggleAll);
    }
    if (isToggled && (event.ctrlKey || event.metaKey)) {
      // collapse all direct children to only expand one level
      node.children
        .filter((c) => c.children.length)
        .forEach((n) => {
          newSet.add(n.account);
        });
    }
    treeState.toggled = newSet;
  }
</script>

<span class="group-hover:bg-muted/50 droptarget border" data-account-name={node.account}>
  {#if node.children.length > 0}
    <Button class="absolute" variant="ghost" size="xs" onclick={handleClick}>
      {#if treeState.isToggled(node.account)}
        <ChevronRight />
      {:else}
        <ChevronDown />
      {/if}
    </Button>
  {/if}
  <a href={urlForAccount(node.account)}>
    {leaf(node.account)}
  </a>
</span>

<style>
  a {
      margin-left: 1.7em;
  }

  span {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: calc(14em - var(--account-indent, 0em));
    max-width: calc(30em - var(--account-indent, 0em));
    margin-left: var(--account-indent, 0);
  }

  /* Indent each level of account by one more 1em. */
  :global(ol ol) span {
    --account-indent: 1em;
  }

  :global(ol ol ol) span {
    --account-indent: 2em;
  }

  :global(ol ol ol ol) span {
    --account-indent: 3em;
  }

  :global(ol ol ol ol ol) span {
    --account-indent: 4em;
  }

  :global(ol ol ol ol ol ol) span {
    --account-indent: 5em;
  }

  :global(ol ol ol ol ol ol ol) span {
    --account-indent: 6em;
  }

  :global(ol ol ol ol ol ol ol ol) span {
    --account-indent: 7em;
  }

  :global(ol ol ol ol ol ol ol ol ol) span {
    --account-indent: 8em;
  }
</style>
