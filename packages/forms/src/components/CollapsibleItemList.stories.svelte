<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CollapsibleItemList from "./CollapsibleItemList.svelte";

  const { Story } = defineMeta({
    title: "Forms/Collapsible Item List",
    component: CollapsibleItemList,
    parameters: {
      docs: {
        description: {
          component:
            "The original shared repeatable-group header, retained during Stage 2. It has a UI Forms counterpart; use that documented target for new reusable work. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for when a list header is preferable to editable entry sections.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let open = $state(true);
  let sources = $state(["Main card"]);
</script>

<Story
  name="Collapses and adds sources"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse Sources" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand Sources" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand Sources" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Add source" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("2 sources");
  }}
>
  {#snippet template()}
    <div class="max-w-md">
      <CollapsibleItemList
        title="Sources"
        addLabel="source"
        count={sources.length}
        {open}
        onToggle={() => (open = !open)}
        onAdd={() => (sources = [...sources, `Source ${sources.length + 1}`])}
      >
        {#snippet children()}
          <ul class="flex flex-col gap-2 text-sm">
            {#each sources as source}
              <li
                class="border-border bg-muted/30 rounded-md border border-dashed px-2.5 py-2"
              >
                {source}
              </li>
            {/each}
          </ul>
        {/snippet}
      </CollapsibleItemList>
      <output class="text-muted-foreground mt-2 block text-sm">
        {sources.length}
        {sources.length === 1 ? "source" : "sources"}
      </output>
    </div>
  {/snippet}
</Story>
