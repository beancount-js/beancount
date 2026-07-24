<script lang="ts">
  import { scaleLinear, scaleUtc } from "d3-scale";
  import { area, curveMonotoneX, line } from "d3-shape";

  import DashboardChartTooltip from "./DashboardChartTooltip.svelte";
  import {
    dashboardPercentageChange,
    dashboardTrendTone,
    type DashboardPoint,
  } from "./model";

  export let points: DashboardPoint[] = [];
  export let currency = "";
  export let change = 0;
  export let formatter: (value: number, currency: string) => string;

  const width = 820;
  const height = 250;
  const inset = { top: 18, right: 18, bottom: 34, left: 18 };

  let activeIndex: number | undefined;
  let chartContainer: HTMLDivElement;
  let chartSvg: SVGSVGElement;
  let keyboardActive = false;
  let tooltipX = 0;
  let tooltipY = 0;

  $: orderedPoints = [...points].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );
  $: values = orderedPoints.map((point) => point.value);
  $: valueMin = values.length ? Math.min(...values) : 0;
  $: valueMax = values.length ? Math.max(...values) : 0;
  $: rawSpan = valueMax - valueMin;
  $: valuePadding = rawSpan
    ? rawSpan * 0.09
    : Math.max(Math.abs(valueMax) * 0.05, 1);
  $: xScale = scaleUtc()
    .domain([
      orderedPoints[0]?.date ?? new Date(),
      orderedPoints.at(-1)?.date ?? new Date(),
    ])
    .range([inset.left, width - inset.right]);
  $: yScale = scaleLinear()
    .domain([valueMin - valuePadding, valueMax + valuePadding])
    .range([height - inset.bottom, inset.top]);
  $: lineGenerator = line<DashboardPoint>()
    .x((point) => xScale(point.date))
    .y((point) => yScale(point.value))
    .curve(curveMonotoneX);
  $: areaGenerator = area<DashboardPoint>()
    .x((point) => xScale(point.date))
    .y0(height - inset.bottom)
    .y1((point) => yScale(point.value))
    .curve(curveMonotoneX);
  $: linePath = lineGenerator(orderedPoints) ?? "";
  $: areaPath = areaGenerator(orderedPoints) ?? "";
  $: if (activeIndex !== undefined && activeIndex >= orderedPoints.length) {
    activeIndex = orderedPoints.length ? orderedPoints.length - 1 : undefined;
  }
  $: activePoint =
    activeIndex === undefined ? undefined : orderedPoints[activeIndex];
  $: activeX = activePoint ? xScale(activePoint.date) : inset.left;
  $: activeY = activePoint ? yScale(activePoint.value) : inset.top;
  $: startValue = orderedPoints[0]?.value ?? 0;
  $: activeChange = activePoint ? activePoint.value - startValue : 0;
  $: activePercent = activePoint
    ? dashboardPercentageChange(startValue, activePoint.value)
    : null;
  $: activeDetail = activePoint
    ? `${activeChange >= 0 ? "↗" : "↘"} ${formatter(activeChange, currency)}${activePercent === null ? "" : ` (${activePercent.toFixed(1)}%)`}`
    : "";
  $: latest = orderedPoints.at(-1)?.value ?? 0;
  $: trendTone = dashboardTrendTone(change);

  function formatDate(date: Date) {
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function nearestIndex(time: number) {
    let result = 0;
    let distance = Number.POSITIVE_INFINITY;
    orderedPoints.forEach((point, index) => {
      const nextDistance = Math.abs(point.date.getTime() - time);
      if (nextDistance < distance) {
        distance = nextDistance;
        result = index;
      }
    });
    return result;
  }

  function positionTooltip(index: number) {
    const point = orderedPoints[index];
    if (!point) return;
    const containerRect = chartContainer.getBoundingClientRect();
    const svgRect = chartSvg.getBoundingClientRect();
    const scaleX = svgRect.width / width;
    const scaleY = svgRect.height / height;
    const x = svgRect.left - containerRect.left + xScale(point.date) * scaleX;
    const y = svgRect.top - containerRect.top + yScale(point.value) * scaleY;
    tooltipX = Math.max(112, Math.min(x, containerRect.width - 112));
    tooltipY = Math.max(80, y);
  }

  function setActive(index: number) {
    activeIndex = Math.max(0, Math.min(index, orderedPoints.length - 1));
    positionTooltip(activeIndex);
  }

  function handlePointer(event: PointerEvent) {
    if (!orderedPoints.length) return;
    keyboardActive = false;
    const rect = chartSvg.getBoundingClientRect();
    const viewX =
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * width;
    const boundedX = Math.max(inset.left, Math.min(viewX, width - inset.right));
    setActive(nearestIndex(xScale.invert(boundedX).getTime()));
  }

  function handleFocus() {
    keyboardActive = true;
    setActive(activeIndex ?? orderedPoints.length - 1);
  }

  function handleBlur() {
    keyboardActive = false;
    activeIndex = undefined;
  }

  function handlePointerLeave() {
    if (!keyboardActive) activeIndex = undefined;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!orderedPoints.length) return;
    keyboardActive = true;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((activeIndex ?? orderedPoints.length) - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((activeIndex ?? -1) + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(orderedPoints.length - 1);
    } else if (event.key === "Escape") {
      chartContainer.blur();
    }
  }
</script>

{#if orderedPoints.length > 1}
  <div
    class:positive={trendTone === "positive"}
    class:negative={trendTone === "negative"}
    class:neutral={trendTone === "neutral"}
    class="relative rounded-md px-5 pb-4 pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    bind:this={chartContainer}
    role="slider"
    tabindex="0"
    aria-label="Explore net worth by date"
    aria-orientation="horizontal"
    aria-valuemin="0"
    aria-valuemax={orderedPoints.length - 1}
    aria-valuenow={activeIndex ?? orderedPoints.length - 1}
    aria-valuetext={`${formatDate(activePoint?.date ?? orderedPoints.at(-1)?.date ?? new Date())}: ${formatter(activePoint?.value ?? latest, currency)}`}
    data-dashboard-net-worth-chart
    on:pointerdown={handlePointer}
    on:pointermove={handlePointer}
    on:pointerleave={handlePointerLeave}
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:keydown={handleKeydown}
  >
    <svg
      bind:this={chartSvg}
      viewBox={`0 0 ${width} ${height}`}
      class="w-full"
      role="img"
      aria-label="Net worth over time"
    >
      <defs>
        <linearGradient
          id="dashboard-net-worth-area"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="var(--dashboard-series)"
            stop-opacity="0.2"
          />
          <stop
            offset="1"
            stop-color="var(--dashboard-series)"
            stop-opacity="0.01"
          />
        </linearGradient>
        <clipPath id="dashboard-net-worth-active-clip">
          <rect
            x={inset.left}
            y="0"
            width={Math.max(0, activeX - inset.left)}
            {height}
          />
        </clipPath>
      </defs>

      <path d={areaPath} class="area" />
      <path
        d={linePath}
        class:muted-line={Boolean(activePoint)}
        class:series-line={!activePoint}
        class="line"
        data-dashboard-line-base
      />
      {#if activePoint}
        <path
          d={linePath}
          class="line series-line"
          clip-path="url(#dashboard-net-worth-active-clip)"
          data-dashboard-line-active
        />
        <line
          x1={activeX}
          x2={activeX}
          y1={inset.top}
          y2={height - inset.bottom}
          class="crosshair"
          data-dashboard-crosshair
        />
        <circle
          cx={activeX}
          cy={activeY}
          r="4.5"
          class="active-dot"
          data-dashboard-active-point
        />
      {/if}

      <text
        x={inset.left}
        y={height - 7}
        class="axis"
        data-dashboard-date-label
      >
        {formatDate(orderedPoints[0].date)}
      </text>
      <text
        x={width - inset.right}
        y={height - 7}
        text-anchor="end"
        class="axis"
        data-dashboard-date-label
      >
        {formatDate(orderedPoints.at(-1)?.date ?? new Date())}
      </text>
    </svg>

    <DashboardChartTooltip
      visible={Boolean(activePoint)}
      x={tooltipX}
      y={tooltipY}
      title={activePoint ? formatDate(activePoint.date) : ""}
      value={activePoint ? formatter(activePoint.value, currency) : ""}
      detail={activeDetail}
    />
  </div>
{:else}
  <div
    class="grid min-h-52 place-items-center px-6 text-center text-sm text-muted-foreground"
  >
    A longer date range is needed to chart net worth.
    {#if orderedPoints.length}
      <span class="mt-1 block font-mono text-xs text-foreground"
        >{formatter(latest, currency)}</span
      >
    {/if}
  </div>
{/if}

<style>
  .positive {
    --dashboard-series: var(--chart-2);
  }

  .negative {
    --dashboard-series: var(--destructive);
  }

  .neutral {
    --dashboard-series: var(--primary);
  }

  .area {
    fill: url(#dashboard-net-worth-area);
  }

  .line {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.25;
    transition:
      stroke 140ms ease,
      opacity 140ms ease;
  }

  .series-line {
    stroke: var(--dashboard-series);
  }

  .muted-line {
    stroke: color-mix(in oklch, var(--muted-foreground) 62%, transparent);
  }

  .crosshair {
    stroke: color-mix(in oklch, var(--muted-foreground) 45%, transparent);
    stroke-dasharray: 3 4;
    stroke-width: 1;
  }

  .active-dot {
    fill: var(--dashboard-series);
    stroke: var(--background);
    stroke-width: 2.5;
  }

  .axis {
    fill: var(--muted-foreground);
    font-family: "Source Code Pro", monospace;
    font-size: 10px;
  }

  @media (prefers-reduced-motion: reduce) {
    .line {
      transition: none;
    }
  }
</style>
