<script lang="ts">
  let {
    detail = "",
    title = "",
    value = "",
    visible = false,
    x = 0,
    y = 0,
  }: {
    detail?: string;
    title?: string;
    value?: string;
    visible?: boolean;
    x?: number;
    y?: number;
  } = $props();
</script>

{#if visible}
  <div
    class="pointer-events-none absolute min-w-44 -translate-x-1/2 -translate-y-[calc(100%+0.75rem)] rounded-lg border border-border/80 bg-popover px-3 py-2 text-popover-foreground shadow-lg"
    style={`left: ${x}px; top: ${y}px`}
    data-dashboard-chart-tooltip
    role="status"
    aria-live="polite"
  >
    <p class="text-xs text-muted-foreground">{title}</p>
    <p
      class="mt-1 flex items-baseline justify-between gap-3 font-mono text-sm tabular-nums"
    >
      <span class="font-medium text-foreground">{value}</span>
      {#if detail}
        <span class="text-xs text-muted-foreground">{detail}</span>
      {/if}
    </p>
  </div>
{/if}
