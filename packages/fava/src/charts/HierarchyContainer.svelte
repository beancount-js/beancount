<script lang="ts">
  import type { Writable } from "svelte/store";

  import { hierarchyChartMode, treemapCurrency } from "../stores/chart";

  import type { HierarchyChart } from "./hierarchy";
  import Sunburst from "./Sunburst.svelte";
  import Treemap from "./Treemap.svelte";

  export let chart: HierarchyChart;
  export let width: number;
  export let height: number = 400;
  export let treemapCurrencies: Writable<string[]>;

  $: data = chart.data;
  $: currencies = [...data.keys()];
  $: treemapCurrencies.set(currencies);

  $: if ($treemapCurrency === null) {
    $treemapCurrency = $treemapCurrency ?? currencies[0] ?? null;
  }

  $: currency = data.has($treemapCurrency || "")
    ? $treemapCurrency
    : currencies[0];

  $: mode = $hierarchyChartMode;
  $: hierarchyData = data.get(currency ?? "");

  $: treemap = mode === "treemap" ? data.get(currency ?? "") : undefined;
</script>

{#if currencies.length === 0}
  <svg viewBox={`0 0 ${width.toString()} 160`}>
    <text class="empty-label" x={width / 2} y={80} text-anchor="middle">
      {"Chart is empty."}
    </text>
  </svg>
{:else if treemap && currency}
  <Treemap data={treemap} {currency} {width} />
{:else if mode === "sunburst" && currency && hierarchyData}
  <svg viewBox={`0 0 ${width.toString()} ${height}`}>
    <g transform={`translate(0,0)`}>
      <Sunburst data={hierarchyData} {currency} {width} {height} />
    </g>
  </svg>
{/if}

<style>
  .empty-label {
    fill: var(--muted-foreground);
    font-family: "DM Sans Variable", sans-serif;
    font-size: 13px;
    font-weight: 600;
  }
</style>
