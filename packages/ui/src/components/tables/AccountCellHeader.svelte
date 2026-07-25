<script lang="ts">
  let {
    hasCollapsed,
    onToggleAll,
  }: {
    hasCollapsed: boolean;
    onToggleAll: () => void;
  } = $props();

  const helpTitle =
    "Hold Shift while clicking to expand all children.\n" +
    "Hold Ctrl or Cmd while clicking to expand one level.";
</script>

<span title={helpTitle}>
  {#if hasCollapsed}
    <button
      class="clickable-icon view-action"
      aria-label="Unfold All"
      on:click={onToggleAll}
    >
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
        class="svg-icon lucide-unfold-vertical"
      >
        <path d="M12 22v-6"></path>
        <path d="M12 8V2"></path>
        <path d="M4 12H2"></path>
        <path d="M10 12H8"></path>
        <path d="M16 12h-2"></path>
        <path d="M22 12h-2"></path>
        <path d="m15 19-3 3-3-3"></path>
        <path d="m15 5-3-3-3 3"></path>
      </svg>
    </button>
  {:else}
    <button
      class="clickable-icon view-action"
      aria-label="Fold All"
      on:click={onToggleAll}
    >
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
        class="svg-icon lucide-fold-vertical"
      >
        <path d="M12 22v-6"></path>
        <path d="M12 8V2"></path>
        <path d="M4 12H2"></path>
        <path d="M10 12H8"></path>
        <path d="M16 12h-2"></path>
        <path d="M22 12h-2"></path>
        <path d="m15 19-3 3-3-3"></path>
        <path d="m15 5-3-3-3 3"></path>
      </svg>
    </button>
  {/if}
</span>

<style>
  span {
    flex: 1;
    min-width: 14em;
    max-width: 30em;
  }
</style>
