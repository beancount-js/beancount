<script lang="ts">
  import { urlForAccount } from "../../helpers";
  import type { DashboardCategory } from "./model";

  export let inflows: DashboardCategory[] = [];
  export let outflows: DashboardCategory[] = [];
  export let currency = "";
  export let formatter: (value: number, currency: string) => string;

  const width = 1000;
  const sideX = 14;
  const centreX = 472;
  const rightX = 814;
  const barWidth = 14;
  const gap = 12;
  const chartHeight = 340;
  const usableHeight = chartHeight - gap * 2;

  type Positioned = DashboardCategory & { y: number; height: number };

  function position(entries: DashboardCategory[]): Positioned[] {
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (!total) return [];
    // Each visible category needs two readable lines (name and value), so the
    // minimum is intentionally larger than a purely visual Sankey bar.
    const minimumHeight = 30;
    const availableHeight = Math.max(
      0,
      usableHeight - Math.max(entries.length - 1, 0) * 4,
    );
    const distributableHeight = Math.max(
      0,
      availableHeight - entries.length * minimumHeight,
    );
    let y = gap;
    return entries.map((entry) => {
      const height =
        minimumHeight + (entry.value / total) * distributableHeight;
      const positioned = { ...entry, y, height };
      y += height + 4;
      return positioned;
    });
  }

  $: sources = position(inflows);
  $: targets = position(outflows);
  $: totalIn = inflows.reduce((sum, entry) => sum + entry.value, 0);
  $: totalOut = outflows.reduce((sum, entry) => sum + entry.value, 0);
  $: centreHeight = Math.max(
    28,
    Math.min(
      usableHeight,
      (Math.max(totalIn, totalOut) / Math.max(totalIn, totalOut, 1)) *
        usableHeight,
    ),
  );
  $: centreY = Math.max(gap, (chartHeight - centreHeight) / 2);
  $: isEmpty = !sources.length && !targets.length;

  function flowPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    height: number,
  ) {
    const bend = (toX - fromX) * 0.46;
    return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY} L ${toX} ${toY + height} C ${toX - bend} ${toY + height}, ${fromX + bend} ${fromY + height}, ${fromX} ${fromY + height} Z`;
  }
</script>

{#if isEmpty}
  <div
    class="grid min-h-60 place-items-center px-6 text-center text-sm text-muted-foreground"
  >
    No cash-flow activity matches this period.
  </div>
{:else}
  <div class="overflow-x-auto px-3 py-4">
    <svg
      class="min-w-[720px] text-foreground"
      viewBox={`0 0 ${width} ${chartHeight}`}
      role="img"
      aria-label="Cash flow from income and refunds to outflows"
    >
      <defs>
        {#each sources as source (source.account)}
          <linearGradient
            id={`source-${source.account.replaceAll(/[^a-z0-9]/gi, "-")}`}
            x1="0"
            x2="1"
          >
            <stop offset="0" stop-color={source.color} stop-opacity="0.48" />
            <stop offset="1" stop-color="#7667d9" stop-opacity="0.35" />
          </linearGradient>
        {/each}
        {#each targets as target (target.account)}
          <linearGradient
            id={`target-${target.account.replaceAll(/[^a-z0-9]/gi, "-")}`}
            x1="0"
            x2="1"
          >
            <stop offset="0" stop-color="#7667d9" stop-opacity="0.35" />
            <stop offset="1" stop-color={target.color} stop-opacity="0.48" />
          </linearGradient>
        {/each}
      </defs>

      {#each sources as source, index (source.account)}
        <path
          d={flowPath(
            sideX + barWidth,
            source.y,
            centreX,
            centreY + (index / Math.max(sources.length, 1)) * centreHeight,
            source.height,
          )}
          fill={`url(#source-${source.account.replaceAll(/[^a-z0-9]/gi, "-")})`}
        />
      {/each}
      {#each targets as target, index (target.account)}
        <path
          d={flowPath(
            centreX + barWidth,
            centreY + (index / Math.max(targets.length, 1)) * centreHeight,
            rightX,
            target.y,
            target.height,
          )}
          fill={`url(#target-${target.account.replaceAll(/[^a-z0-9]/gi, "-")})`}
        />
      {/each}

      {#each sources as source (source.account)}
        <a
          href={source.account === "Other"
            ? undefined
            : urlForAccount(source.account)}
        >
          <rect
            x={sideX}
            y={source.y}
            width={barWidth}
            height={source.height}
            rx="3"
            fill={source.color}
          />
          <text
            x={sideX + 22}
            y={source.y + Math.min(source.height / 2 + 4, 15)}
            class="label"
          >
            {source.label}
          </text>
          <text
            x={sideX + 22}
            y={source.y + Math.min(source.height / 2 + 19, 30)}
            class="amount"
          >
            {formatter(source.value, currency)}
          </text>
        </a>
      {/each}

      <rect
        x={centreX}
        y={centreY}
        width={barWidth}
        height={centreHeight}
        rx="3"
        fill="#7667d9"
      />
      <text x={centreX + 22} y={centreY + centreHeight / 2 - 4} class="label"
        >Cash flow</text
      >
      <text x={centreX + 22} y={centreY + centreHeight / 2 + 12} class="amount">
        {formatter(totalIn - totalOut, currency)}
      </text>

      {#each targets as target (target.account)}
        <a
          href={target.account === "Other"
            ? undefined
            : urlForAccount(target.account)}
        >
          <rect
            x={rightX}
            y={target.y}
            width={barWidth}
            height={target.height}
            rx="3"
            fill={target.color}
          />
          <text
            x={rightX + 22}
            y={target.y + Math.min(target.height / 2 + 4, 15)}
            class="label"
          >
            {target.label}
          </text>
          <text
            x={rightX + 22}
            y={target.y + Math.min(target.height / 2 + 19, 30)}
            class="amount"
          >
            {formatter(target.value, currency)}
          </text>
        </a>
      {/each}
    </svg>
  </div>
{/if}

<style>
  .label {
    fill: hsl(var(--foreground));
    font-family: "DM Sans Variable", sans-serif;
    font-size: 13px;
    font-weight: 600;
  }

  .amount {
    fill: hsl(var(--muted-foreground));
    font-family: "Source Code Pro", monospace;
    font-size: 11px;
  }

  a:hover rect {
    filter: brightness(0.9);
  }
</style>
