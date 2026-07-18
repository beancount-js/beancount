<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CodeEditor from "./CodeEditor.svelte";

  const { Story } = defineMeta({
    title: "Forms/Code Editor",
    component: CodeEditor,
    parameters: {
      docs: {
        description: {
          component:
            "The shared CodeMirror source editor used by YAML and JSON form modes. It supplies semantic theme tokens, syntax diagnostics, and an accessible labelled editing surface. Use YAML Backed Form when the source editor needs reset and apply actions.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let source = $state("version: 1\nsources:\n  - id: main-card\n");
</script>

<Story
  name="Edits YAML source with diagnostics"
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Ledger source" });
    await userEvent.click(editor);
    await userEvent.keyboard("\nnotes: reviewed");
    await expect(canvas.getByRole("status")).toHaveTextContent("reviewed");
  }}
>
  {#snippet template()}
    <div class="flex max-w-2xl flex-col gap-3">
      <CodeEditor
        bind:value={source}
        language="yaml"
        minHeight="14rem"
        ariaLabel="Ledger source"
      />
      <output class="text-sm text-muted-foreground">
        {source.includes("reviewed")
          ? "Source includes reviewed notes"
          : "Source unchanged"}
      </output>
    </div>
  {/snippet}
</Story>
