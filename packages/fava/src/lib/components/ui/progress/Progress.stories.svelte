<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Button } from "$lib/components/ui/button";
  import { Progress } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Data Display/Progress",
    component: Progress,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local progress indicator for a bounded, measurable task. Always pair it with a clear task label and a current value.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let progress = $state(40);
</script>

<Story
  name="Updates an import's completion"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Advance import" }),
    );
    await expect(canvas.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("80% complete");
  }}
>
  {#snippet template()}
    <div class="max-w-md space-y-3">
      <div class="flex items-center justify-between text-sm">
        <span>Importing Starling transactions</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} aria-label="Starling import progress" />
      <Button size="sm" variant="outline" onclick={() => (progress = 80)}>
        Advance import
      </Button>
      <output class="text-sm text-muted-foreground">{progress}% complete</output
      >
    </div>
  {/snippet}
</Story>
