<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import SegmentedControl from "./SegmentedControl.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Segmented Control",
    component: SegmentedControl,
    parameters: {
      docs: {
        description: {
          component:
            "A compact choice control for two or three mutually exclusive options. Keep it inside a centered Form Field row and provide a specific `ariaLabel` that identifies the decision being made. Use Switch for booleans; see the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the control-choice rules.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let sort = $state("date");
</script>

<Story
  name="Changes the selected option"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Amount" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Sorted by amount",
    );
  }}
>
  {#snippet template()}
    <div class="space-y-2">
      <SegmentedControl
        value={sort}
        options={["date", "description", "amount"]}
        labels={{ date: "Date", description: "Description", amount: "Amount" }}
        ariaLabel="Sort transactions by"
        onChange={(value) => (sort = value)}
      />
      <output class="block text-sm text-muted-foreground">
        Sorted by {sort}
      </output>
    </div>
  {/snippet}
</Story>
