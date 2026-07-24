<script lang="ts">
  import { urlForAccount } from "../../helpers";
  import DashboardChartTooltip from "./DashboardChartTooltip.svelte";
  import {
    dashboardFlowBalance,
    dashboardFlowDeficitAccount,
    dashboardFlowLayout,
    dashboardFlowSurplusAccount,
  } from "./geometry";
  import type { DashboardCategory } from "./model";

  export let inflows: DashboardCategory[] = [];
  export let outflows: DashboardCategory[] = [];
  export let currency = "";
  export let formatter: (value: number, currency: string) => string;

  const width = 1000;
  const sideX = 14;
  const centerX = 472;
  const rightX = 814;
  const barWidth = 14;
  const chartHeight = 480;

  type FlowSide = "in" | "out";
  type ActiveFlow = DashboardCategory & { side: FlowSide };

  let active: ActiveFlow | undefined;
  let chartContainer: HTMLDivElement;
  let tooltipX = 0;
  let tooltipY = 0;

  $: flow = dashboardFlowBalance(inflows, outflows);
  $: layout = dashboardFlowLayout(
    flow.sources,
    flow.targets,
    chartHeight,
    16,
    32,
  );
  $: cashFlowColor =
    flow.cashFlow > 0
      ? "#059669"
      : flow.cashFlow < 0
        ? "#dc2626"
        : "var(--primary)";
  $: flowAriaLabel =
    flow.cashFlow > 0
      ? "Cash flow from income and refunds to outflows and surplus"
      : flow.cashFlow < 0
        ? "Cash flow from income, refunds, and deficit to outflows"
        : "Cash flow from income and refunds to outflows";
  $: isEmpty = !layout.sources.length && !layout.targets.length;
  $: activeTotal = active?.side === "in" ? layout.totalIn : layout.totalOut;
  $: tooltipTitle = active
    ? active.side === "in"
      ? `${active.label} → Cash flow`
      : `Cash flow → ${active.label}`
    : "";
  $: tooltipDetail = active
    ? `(${activeTotal ? ((active.value / activeTotal) * 100).toFixed(1) : "0.0"}%)`
    : "";

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

  function gradientId(side: FlowSide, account: string) {
    return `dashboard-flow-${side}-${account.replaceAll(/[^a-z0-9]/gi, "-")}`;
  }

  function positionTooltip(event: MouseEvent | FocusEvent | PointerEvent) {
    const containerRect = chartContainer.getBoundingClientRect();
    const targetRect = (event.currentTarget as Element).getBoundingClientRect();
    const hasPointerCoordinates = "clientX" in event && event.clientX !== 0;
    const clientX = hasPointerCoordinates
      ? event.clientX
      : targetRect.left + targetRect.width / 2;
    const clientY = hasPointerCoordinates
      ? event.clientY
      : targetRect.top + targetRect.height / 2;
    tooltipX = Math.max(
      104,
      Math.min(clientX - containerRect.left, containerRect.width - 104),
    );
    tooltipY = Math.max(72, clientY - containerRect.top);
  }

  function activate(
    entry: DashboardCategory,
    side: FlowSide,
    event: MouseEvent | FocusEvent | PointerEvent,
  ) {
    active = { ...entry, side };
    positionTooltip(event);
  }

  function clearActive() {
    active = undefined;
  }

  function handleKeydown(
    event: KeyboardEvent,
    entry: DashboardCategory,
    side: FlowSide,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(entry, side, event as unknown as FocusEvent);
    } else if (event.key === "Escape") {
      clearActive();
      (event.currentTarget as SVGPathElement).blur();
    }
  }

  function isActive(entry: DashboardCategory, side: FlowSide) {
    return active?.side === side && active.account === entry.account;
  }

  function isDimmed(entry: DashboardCategory, side: FlowSide) {
    return Boolean(active && !isActive(entry, side));
  }

  function isAccountLink(entry: DashboardCategory) {
    return ![
      "Other",
      dashboardFlowDeficitAccount,
      dashboardFlowSurplusAccount,
    ].includes(entry.account);
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
    <div class="relative min-w-[720px]" bind:this={chartContainer}>
      <svg
        class="w-full text-foreground"
        viewBox={`0 0 ${width} ${chartHeight}`}
        role="group"
        aria-label={flowAriaLabel}
        data-dashboard-flow
        on:pointerleave={clearActive}
      >
        <defs>
          {#each layout.sources as source (source.account)}
            <linearGradient id={gradientId("in", source.account)} x1="0" x2="1">
              <stop offset="0" stop-color={source.color} stop-opacity="0.5" />
              <stop offset="1" stop-color={cashFlowColor} stop-opacity="0.48" />
            </linearGradient>
          {/each}
          {#each layout.targets as target (target.account)}
            <linearGradient
              id={gradientId("out", target.account)}
              x1="0"
              x2="1"
            >
              <stop offset="0" stop-color={cashFlowColor} stop-opacity="0.48" />
              <stop offset="1" stop-color={target.color} stop-opacity="0.72" />
            </linearGradient>
          {/each}
        </defs>

        {#each layout.sources as source (source.account)}
          <path
            d={flowPath(
              sideX + barWidth,
              source.y,
              centerX,
              source.centerY,
              source.height,
            )}
            fill={`url(#${gradientId("in", source.account)})`}
            class:dimmed={isDimmed(source, "in")}
            class:active={isActive(source, "in")}
            class="flow-stream"
            role="button"
            tabindex="0"
            aria-label={`${source.label} to Cash flow: ${formatter(source.value, currency)}`}
            data-dashboard-flow-stream
            data-side="in"
            data-account={source.account}
            data-active={isActive(source, "in")}
            on:pointerenter={(event) => activate(source, "in", event)}
            on:pointermove={positionTooltip}
            on:focus={(event) => activate(source, "in", event)}
            on:blur={clearActive}
            on:click={(event) => activate(source, "in", event)}
            on:keydown={(event) => handleKeydown(event, source, "in")}
          />
        {/each}
        {#each layout.targets as target (target.account)}
          <path
            d={flowPath(
              centerX + barWidth,
              target.centerY,
              rightX,
              target.y,
              target.height,
            )}
            fill={`url(#${gradientId("out", target.account)})`}
            class:dimmed={isDimmed(target, "out")}
            class:active={isActive(target, "out")}
            class="flow-stream"
            role="button"
            tabindex="0"
            aria-label={`Cash flow to ${target.label}: ${formatter(target.value, currency)}`}
            data-dashboard-flow-stream
            data-side="out"
            data-account={target.account}
            data-active={isActive(target, "out")}
            on:pointerenter={(event) => activate(target, "out", event)}
            on:pointermove={positionTooltip}
            on:focus={(event) => activate(target, "out", event)}
            on:blur={clearActive}
            on:click={(event) => activate(target, "out", event)}
            on:keydown={(event) => handleKeydown(event, target, "out")}
          />
        {/each}

        {#each layout.sources as source (source.account)}
          <a
            href={isAccountLink(source)
              ? urlForAccount(source.account)
              : undefined}
            class:dimmed={isDimmed(source, "in")}
            class="flow-node"
          >
            <rect
              x={sideX}
              y={source.y}
              width={barWidth}
              height={Math.max(source.height, 1.5)}
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
          x={centerX}
          y={layout.centerY}
          width={barWidth}
          height={layout.centerHeight}
          rx="3"
          fill={cashFlowColor}
        />
        <text
          x={centerX + 22}
          y={layout.centerY + layout.centerHeight / 2 - 4}
          class="label">Cash flow</text
        >
        <text
          x={centerX + 22}
          y={layout.centerY + layout.centerHeight / 2 + 12}
          class="amount"
        >
          {formatter(flow.cashFlow, currency)}
        </text>

        {#each layout.targets as target (target.account)}
          <a
            href={isAccountLink(target)
              ? urlForAccount(target.account)
              : undefined}
            class:dimmed={isDimmed(target, "out")}
            class="flow-node"
          >
            <rect
              x={rightX}
              y={target.y}
              width={barWidth}
              height={Math.max(target.height, 1.5)}
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

      <DashboardChartTooltip
        visible={Boolean(active)}
        x={tooltipX}
        y={tooltipY}
        title={tooltipTitle}
        value={active ? formatter(active.value, currency) : ""}
        detail={tooltipDetail}
      />
    </div>
  </div>
{/if}

<style>
  .label {
    fill: var(--foreground);
    font-family: "DM Sans Variable", sans-serif;
    font-size: 13px;
    font-weight: 600;
  }

  .amount {
    fill: var(--muted-foreground);
    font-family: "Source Code Pro", monospace;
    font-size: 11px;
  }

  .flow-stream,
  .flow-node {
    cursor: pointer;
    opacity: 1;
    transition:
      filter 140ms ease,
      opacity 140ms ease;
  }

  .flow-stream:focus {
    outline: none;
    filter: brightness(0.94) saturate(1.08);
  }

  .flow-stream.active,
  .flow-node:hover {
    filter: brightness(0.94) saturate(1.08);
  }

  .flow-stream.dimmed,
  .flow-node.dimmed {
    opacity: 0.14;
  }

  @media (prefers-reduced-motion: reduce) {
    .flow-stream,
    .flow-node {
      transition: none;
    }
  }
</style>
