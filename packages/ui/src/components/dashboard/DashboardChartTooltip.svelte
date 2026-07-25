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
    class="cn-dashboard-dashboardcharttooltip-21-1"
    style={`left: ${x}px; top: ${y}px`}
    data-dashboard-chart-tooltip
    role="status"
    aria-live="polite"
  >
    <p class="cn-dashboard-dashboardcharttooltip-27-1">{title}</p>
    <p class="cn-dashboard-dashboardcharttooltip-29-1">
      <span class="cn-dashboard-dashboardcharttooltip-31-1">{value}</span>
      {#if detail}
        <span class="cn-dashboard-dashboardcharttooltip-33-1">{detail}</span>
      {/if}
    </p>
  </div>
{/if}
