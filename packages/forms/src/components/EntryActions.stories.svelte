<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import EntryActions from "./EntryActions.svelte";

  const { Story } = defineMeta({
    title: "Forms/Entry Actions",
    component: EntryActions,
    parameters: {
      docs: {
        description: {
          component:
            "The original shared move/remove affordance for a repeated entry, retained during Stage 2. Its UI Forms counterpart is the target for new shared primitives; pair it with custom entry content only when the item does not need Form Section Header's own title and disclosure.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let position = $state(1);
  let removed = $state(false);
</script>

<Story
  name="Reorders and removes an entry"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Move up" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Position 1 of 3",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove source" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Source removed",
    );
  }}
>
  {#snippet template()}
    {#if removed}
      <p role="status" class="text-muted-foreground text-sm">Source removed</p>
    {:else}
      <div class="flex max-w-md flex-col gap-2">
        <EntryActions
          index={position}
          total={3}
          removeLabel="Remove source"
          onMove={(direction) => (position += direction)}
          onRemove={() => (removed = true)}
        >
          {#snippet children()}
            <p class="text-sm font-medium">Barclays checking account</p>
          {/snippet}
        </EntryActions>
        <output class="text-muted-foreground text-sm"
          >Position {position + 1} of 3</output
        >
      </div>
    {/if}
  {/snippet}
</Story>
