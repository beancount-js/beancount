<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CollapsibleItemList from "./CollapsibleItemList.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Collapsible Item List",
    component: CollapsibleItemList,
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
          <ul class="space-y-1 text-sm">
            {#each sources as source}
              <li>{source}</li>
            {/each}
          </ul>
        {/snippet}
      </CollapsibleItemList>
      <output class="mt-2 block text-sm text-muted-foreground">
        {sources.length}
        {sources.length === 1 ? "source" : "sources"}
      </output>
    </div>
  {/snippet}
</Story>
