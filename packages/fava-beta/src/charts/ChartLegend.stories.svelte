<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ChartLegend from "./ChartLegend.svelte";

  const legend: [string, string | null][] = [
    ["GBP", "#6d5bd0"],
    ["USD", "#008a6a"],
  ];

  const { Story } = defineMeta({
    title: "Fava/Charts/Chart Legend",
    component: ChartLegend,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's interactive chart legend. It can select one active series or hide individual series, so the data view remains understandable when a chart includes multiple currencies.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { writable } from "svelte/store";

  const active = writable<string | null>("GBP");
  const toggled = writable<string[]>([]);
</script>

<Story
  name="Selects the active currency"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Toggle USD" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("USD");
  }}
>
  {#snippet template()}
    <div class="flex max-w-md flex-col gap-3">
      <ChartLegend {legend} {active} />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Active currency: {$active ?? "None"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows every visible currency">
  {#snippet template()}
    <div class="max-w-md">
      <ChartLegend {legend} {toggled} />
    </div>
  {/snippet}
</Story>
