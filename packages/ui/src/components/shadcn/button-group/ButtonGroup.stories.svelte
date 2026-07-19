<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Button } from "../button";
  import * as ButtonGroup from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Actions/Button Group",
    component: ButtonGroup.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Groups related button actions into one compact control. Keep the actions independent and use a labelled separator only when it clarifies the group.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let currentView = $state("month");
</script>

<Story
  name="Groups related views"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Week" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Showing week view",
    );
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <ButtonGroup.Root aria-label="Statement view">
        <Button
          variant={currentView === "month" ? "default" : "outline"}
          onclick={() => (currentView = "month")}
        >
          Month
        </Button>
        <ButtonGroup.Separator />
        <Button
          variant={currentView === "week" ? "default" : "outline"}
          onclick={() => (currentView = "week")}
        >
          Week
        </Button>
      </ButtonGroup.Root>
      <output class="block text-sm text-muted-foreground">
        Showing {currentView} view
      </output>
    </div>
  {/snippet}
</Story>
