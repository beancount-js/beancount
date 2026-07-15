<script lang="ts">
  import { arc, pie, type PieArcDatum } from "d3-shape";
  import { urlForAccount } from "../../helpers";
  import type { DashboardCategory } from "./model";

  export let categories: DashboardCategory[] = [];
  export let currency = "";
  export let formatter: (value: number, currency: string) => string;

  let hovered: DashboardCategory | undefined;

  const arcGenerator = arc<PieArcDatum<DashboardCategory>>()
    .innerRadius(64)
    .outerRadius(98)
    .padAngle(0.018)
    .cornerRadius(4);

  $: arcs = pie<DashboardCategory>()
    .value((entry) => entry.value)
    .sort(null)(categories);
  $: total = categories.reduce((sum, entry) => sum + entry.value, 0);
  $: centerCategory = hovered;
</script>

<div class="grid min-h-64 place-items-center p-4">
  {#if total}
    <svg
      viewBox="-116 -116 232 232"
      class="size-56"
      role="img"
      aria-label="Outflows by account"
    >
      {#each arcs as arcDatum (arcDatum.data.account)}
        <a
          href={arcDatum.data.account === "Other"
            ? undefined
            : urlForAccount(arcDatum.data.account)}
          class:dimmed={Boolean(
            hovered && hovered.account !== arcDatum.data.account,
          )}
          on:mouseenter={() => (hovered = arcDatum.data)}
          on:mouseleave={() => (hovered = undefined)}
          on:focus={() => (hovered = arcDatum.data)}
          on:blur={() => (hovered = undefined)}
        >
          <path d={arcGenerator(arcDatum) ?? ""} fill={arcDatum.data.color}>
            <title
              >{`${arcDatum.data.label}: ${formatter(arcDatum.data.value, currency)}`}</title
            >
          </path>
        </a>
      {/each}
      <text text-anchor="middle" y="-7" class="donut-label"
        >{centerCategory?.label ?? "Outflows"}</text
      >
      <text text-anchor="middle" y="16" class="donut-value"
        >{formatter(centerCategory?.value ?? total, currency)}</text
      >
    </svg>
  {:else}
    <p class="text-sm text-muted-foreground">No outflows in this period.</p>
  {/if}
</div>

<style>
  .donut-label {
    fill: hsl(var(--muted-foreground));
    font-family: "DM Sans Variable", sans-serif;
    font-size: 13px;
    font-weight: 600;
  }

  .donut-value {
    fill: hsl(var(--foreground));
    font-family: "Source Code Pro", monospace;
    font-size: 13px;
    font-weight: 600;
  }

  path {
    transition: opacity 120ms ease;
  }

  a.dimmed path {
    opacity: 0.2;
  }
</style>
