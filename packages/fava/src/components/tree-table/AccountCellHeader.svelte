<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { useTreeTable } from "./state.svelte";
  import UnfoldVertical from "lucide-svelte/icons/unfold-vertical";
  import FoldVertical from "lucide-svelte/icons/fold-vertical";

  const treeState = useTreeTable();
  const helpTitle =
    "Hold Shift while clicking to expand all children.\n" +
    "Hold Ctrl or Cmd while clicking to expand one level.";
</script>

<span title={helpTitle} class="group-hover:bg-muted/50 border">
  {#if treeState.toggled.size}
    <Button
      variant="ghost"
      size="xs"
      aria-label="Unfold All"
      onclick={() => treeState.clearToggled()}
    >
      <UnfoldVertical />
    </Button>
  {:else}
    <Button
      variant="ghost"
      size="xs"
      aria-label="Fold All"
      onclick={() => treeState.collapseAll()}
    >
      <FoldVertical />
    </Button>
  {/if}
</span>

<style>
  span {
    flex: 1;
    min-width: 14em;
    max-width: 30em;
  }
</style>
