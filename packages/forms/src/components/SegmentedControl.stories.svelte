<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import SegmentedControl from "./SegmentedControl.svelte";

  const { Story } = defineMeta({
    title: "Forms/Segmented Control",
    component: SegmentedControl,
    parameters: {
      docs: {
        description: {
          component:
            "The original compact choice control for two or three mutually exclusive values, retained during Stage 2. Use Switch for booleans and Filter Command Picker for searchable or larger sets. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the control rules.",
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
    <div class="flex flex-col gap-2">
      <SegmentedControl
        value={sort}
        options={["date", "description", "amount"]}
        labels={{ date: "Date", description: "Description", amount: "Amount" }}
        ariaLabel="Sort transactions by"
        onChange={(value) => (sort = value)}
      />
      <output class="text-muted-foreground text-sm">Sorted by {sort}</output>
    </div>
  {/snippet}
</Story>
