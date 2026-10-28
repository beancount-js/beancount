<script lang="ts">
  import { writable } from "svelte/store";
  import ChartLegend from "../src/domain/charts/ChartLegend.svelte";
  const active = writable<string | null>("Income");
  const toggled = writable(["Expenses"]);
  const legend: [string, string | null][] = [
    ["Income", null],
    ["Expenses", null],
  ];
</script>

<div class="flex flex-col items-start gap-6 p-4">
  <section aria-label="Single chart series">
    <h2 class="mb-2 text-sm">Single chart series</h2>
    <ChartLegend {legend} {active} />
  </section>
  <section aria-label="Multiple chart series">
    <h2 class="mb-2 text-sm">Multiple chart series</h2>
    <ChartLegend {legend} {toggled} />
  </section>
</div>
