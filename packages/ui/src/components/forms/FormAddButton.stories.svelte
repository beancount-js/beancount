<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormAddButton from "./FormAddButton.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Form Add Button",
    component: FormAddButton,
    parameters: {
      docs: {
        description: {
          component:
            "The shared footer affordance for adding a new repeatable item. Place it at the end of a section and give it a domain-specific label, such as Add source.",
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
    <div class="space-y-2">
      <FormAddButton label="Add source" onclick={() => (additions += 1)} />
      <output class="text-sm text-muted-foreground">
        {additions === 0
          ? "No sources added"
          : `${additions} ${additions === 1 ? "source" : "sources"} added`}
      </output>
    </div>
  {/snippet}
</Story>
