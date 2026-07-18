<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ChipAutocomplete from "./ChipAutocomplete.svelte";

  const { Story } = defineMeta({
    title: "Forms/Chip Autocomplete",
    component: ChipAutocomplete,
    parameters: {
      docs: {
        description: {
          component:
            "A retained multi-value editor for journal and rule workflows. It suggests, commits, and removes values as compact chips. Use it only when the domain calls for editable value chips, not for a general searchable choice.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let payees = $state(["Grocer"]);
</script>

<Story
  name="Adds and removes payee aliases"
  play={async ({ canvas }) => {
    await userEvent.type(
      canvas.getByRole("combobox", { name: "Payee aliases" }),
      "Market,",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Grocer, Market",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Market" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("Grocer");
  }}
>
  {#snippet template()}
    <div class="flex max-w-xl flex-col gap-3">
      <ChipAutocomplete
        value={payees}
        label="Payee aliases"
        suggestions={["Market", "Supermarket", "Grocer"]}
        uppercase={false}
        onChange={(items) => {
          payees = items;
        }}
      />
      <output class="text-muted-foreground text-sm">
        {payees.join(", ") || "No aliases"}
      </output>
    </div>
  {/snippet}
</Story>
