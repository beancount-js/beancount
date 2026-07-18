<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import TagEditor from "./TagEditor.svelte";

  const { Story } = defineMeta({
    title: "Forms/Tag Editor",
    component: TagEditor,
    parameters: {
      docs: {
        description: {
          component:
            "The account- and transaction-tag variant of Chip Autocomplete. It is retained with the domain forms package because it adds Beancount tag styling and workflows.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let tags = $state(["review"]);
</script>

<Story
  name="Edits transaction tags"
  play={async ({ canvas }) => {
    await userEvent.type(
      canvas.getByRole("combobox", { name: "Transaction tags" }),
      "travel,",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "review, travel",
    );
  }}
>
  {#snippet template()}
    <div class="flex max-w-xl flex-col gap-3">
      <TagEditor
        value={tags}
        label="Transaction tags"
        suggestions={["review", "travel", "tax"]}
        onChange={(next) => {
          tags = next;
        }}
      />
      <output class="text-muted-foreground text-sm">
        {tags.join(", ") || "No tags"}
      </output>
    </div>
  {/snippet}
</Story>
