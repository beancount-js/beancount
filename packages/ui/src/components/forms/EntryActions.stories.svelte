<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import EntryActions from "./EntryActions.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Entry Actions",
    component: EntryActions,
    parameters: {
      docs: {
        description: {
          component:
            "Hover and keyboard-focus actions for moving or removing one repeated entry. Pair it with custom entry content; use Form Section Header instead when the entry needs its own title and disclosure. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the composition rules.",
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
      <p class="text-sm text-muted-foreground" role="status">Source removed</p>
    {:else}
      <div class="max-w-md space-y-2">
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
        <output class="text-sm text-muted-foreground">
          Position {position + 1} of 3
        </output>
      </div>
    {/if}
  {/snippet}
</Story>
