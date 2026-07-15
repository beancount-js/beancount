<script lang="ts">
  import type { DashboardPoint } from "./model";

  export let points: DashboardPoint[] = [];
  export let currency = "";
  export let formatter: (value: number, currency: string) => string;

  const width = 820;
  const height = 212;
  const inset = { top: 18, right: 18, bottom: 26, left: 18 };

  $: values = points.map((point) => point.value);
  $: min = Math.min(0, ...values);
  $: max = Math.max(0, ...values);
  $: span = max - min || 1;
  $: plotWidth = width - inset.left - inset.right;
  $: plotHeight = height - inset.top - inset.bottom;
  $: coords = points.map((point, index) => ({
    ...point,
    x: inset.left + (index / Math.max(points.length - 1, 1)) * plotWidth,
    y: inset.top + (1 - (point.value - min) / span) * plotHeight,
  }));
  $: polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");
  $: area = coords.length
    ? `${inset.left},${height - inset.bottom} ${polyline} ${coords.at(-1)?.x},${height - inset.bottom}`
    : "";
  $: latest = points.at(-1)?.value ?? 0;
</script>

{#if points.length > 1}
  <div class="px-5 pb-4 pt-3">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      class="w-full"
      role="img"
      aria-label="Net worth over time"
    >
      <line
        x1={inset.left}
        x2={width - inset.right}
        y1={inset.top + (1 - (0 - min) / span) * plotHeight}
        y2={inset.top + (1 - (0 - min) / span) * plotHeight}
        class="baseline"
      />
      <polygon points={area} class="area" />
      <polyline points={polyline} class="line" />
      {#each coords.filter((_, index) => index === 0 || index === coords.length - 1) as point}
        <circle cx={point.x} cy={point.y} r="3.5" class="dot">
          <title
            >{`${point.date.toLocaleDateString()}: ${formatter(point.value, currency)}`}</title
          >
        </circle>
      {/each}
      <text x={inset.left} y={height - 5} class="axis"
        >{points[0].date.toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        })}</text
      >
      <text
        x={width - inset.right}
        y={height - 5}
        text-anchor="end"
        class="axis"
        >{points
          .at(-1)
          ?.date.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}</text
      >
    </svg>
  </div>
{:else}
  <div
    class="grid min-h-52 place-items-center px-6 text-center text-sm text-muted-foreground"
  >
    A longer date range is needed to chart net worth.
    {#if points.length}
      <span class="mt-1 block font-mono text-xs text-foreground"
        >{formatter(latest, currency)}</span
      >
    {/if}
  </div>
{/if}

<style>
  .baseline {
    stroke: hsl(var(--border));
    stroke-dasharray: 3 4;
  }

  .area {
    fill: hsl(var(--primary) / 0.14);
  }

  .line {
    fill: none;
    stroke: hsl(var(--primary));
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.5;
  }

  .dot {
    fill: hsl(var(--background));
    stroke: hsl(var(--primary));
    stroke-width: 2;
  }

  .axis {
    fill: hsl(var(--muted-foreground));
    font-family: "Source Code Pro", monospace;
    font-size: 10px;
  }
</style>
