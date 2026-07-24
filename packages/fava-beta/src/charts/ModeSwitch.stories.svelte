<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ModeSwitch from "./ModeSwitch.svelte";

  const { Story } = defineMeta({
    title: "Fava/Charts/Mode Switch",
    component: ModeSwitch,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's chart-mode selector. It renders the allowed modes from the chart store as accessible tabs and persists the selected visual representation through that store.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { writable, type Writable } from "svelte/store";
  import type { LocalStoreSyncedStore } from "../lib/store";

  const store: LocalStoreSyncedStore<string> = {
    ...(writable("line") as Writable<string>),
    values: () => [
      ["line", "Line chart"],
      ["area", "Area map"],
    ],
  };
</script>

<Story
  name="Changes the chart representation"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Area map" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Area map");
  }}
>
  {#snippet template()}
    <div class="flex max-w-md flex-col gap-3">
      <ModeSwitch {store} />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Chart representation: {$store === "area" ? "Area map" : "Line chart"}
      </output>
    </div>
  {/snippet}
</Story>
