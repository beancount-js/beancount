<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Textarea } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Forms/Textarea",
    component: Textarea,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned multiline text input. Do not use it for YAML editing; use the shared YAML editor for that workflow.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let note = $state("Imported from the main card.");
</script>

<Story
  name="Edits a multiline note"
  play={async ({ canvas }) => {
    const input = canvas.getByLabelText("Import note");
    await userEvent.clear(input);
    await userEvent.type(input, "Reviewed\\nReady to import");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Ready to import",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-md space-y-2">
      <label class="text-sm font-medium" for="catalog-import-note"
        >Import note</label
      >
      <Textarea id="catalog-import-note" bind:value={note} />
      <output class="block whitespace-pre-line text-sm text-muted-foreground">
        {note}
      </output>
    </div>
  {/snippet}
</Story>
