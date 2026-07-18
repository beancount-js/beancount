<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import * as ToggleGroup from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Actions/Toggle Group",
    component: ToggleGroup.Root,
    parameters: {
      docs: {
        description: {
          component:
            "A grouped pressed-state control for related display actions. Use the shared form Segmented Control for two or three form modes.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let timeframe = $state("month");
</script>

<Story
  name="Selects a chart timeframe"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Year" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Showing year timeframe",
    );
  }}
>
  {#snippet template()}
    <div class="flex flex-col items-start gap-3">
      <ToggleGroup.Root
        type="single"
        bind:value={timeframe}
        aria-label="Chart timeframe"
        variant="outline"
      >
        <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
        <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
        <ToggleGroup.Item value="year">Year</ToggleGroup.Item>
      </ToggleGroup.Root>
      <output class="text-sm text-muted-foreground">
        Showing {timeframe} timeframe
      </output>
    </div>
  {/snippet}
</Story>
