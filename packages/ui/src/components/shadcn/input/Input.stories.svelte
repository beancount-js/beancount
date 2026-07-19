<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Input } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Forms/Input",
    component: Input,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned single-line input. Use the shared Form Field when the input belongs in an editable structured form.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let ledgerName = $state("Northstar household");
</script>

<Story
  name="Edits a single-line value"
  play={async ({ canvas }) => {
    const input = canvas.getByLabelText("Ledger name");
    await userEvent.clear(input);
    await userEvent.type(input, "Personal ledger");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Personal ledger",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-sm space-y-2">
      <label class="text-sm font-medium" for="catalog-ledger-name"
        >Ledger name</label
      >
      <Input id="catalog-ledger-name" bind:value={ledgerName} />
      <output class="block text-sm text-muted-foreground">{ledgerName}</output>
    </div>
  {/snippet}
</Story>
