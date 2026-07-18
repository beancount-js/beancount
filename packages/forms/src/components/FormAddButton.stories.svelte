<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormAddButton from "./FormAddButton.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form Add Button",
    component: FormAddButton,
    parameters: {
      docs: {
        description: {
          component:
            "The original shared footer action for a new repeated item, retained during Stage 2. Place it at the end of a section and use the UI Forms counterpart when introducing a new reusable form pattern.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let additions = $state(0);
</script>

<Story
  name="Adds a repeated item"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add source" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "1 source added",
    );
  }}
>
  {#snippet template()}
    <div class="flex flex-col gap-2">
      <FormAddButton label="Add source" onclick={() => (additions += 1)} />
      <output class="text-muted-foreground text-sm">
        {additions === 0
          ? "No sources added"
          : `${additions} ${additions === 1 ? "source" : "sources"} added`}
      </output>
    </div>
  {/snippet}
</Story>
