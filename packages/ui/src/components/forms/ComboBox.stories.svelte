<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import ComboBox from "./ComboBox.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Combo Box",
    component: ComboBox,
    parameters: {
      docs: {
        description: {
          component:
            'A compatibility adapter for an all-or-one searchable filter. It delegates to the shared Filter Command Picker; new editable forms should use that picker directly in `FormField as="div" align="center"`. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for control-choice rules.',
        },
      },
    },
  });

  const merchants = [
    { value: "grocerly", label: "Grocerly" },
    { value: "northstar-cafe", label: "Northstar Cafe" },
  ];
</script>

<script lang="ts">
  let merchant = $state("");
</script>

<Story
  name="Selects a merchant or all merchants"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Merchant" }));
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("option", { name: "Grocerly" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Grocerly");
  }}
>
  {#snippet template()}
    <div class="flex max-w-md flex-col gap-3">
      <ComboBox
        items={merchants}
        value={merchant}
        placeholder="Merchant"
        onValueChange={(value) => {
          merchant = value;
        }}
      />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Filter: {merchants.find((item) => item.value === merchant)?.label ??
          "All merchants"}
      </output>
    </div>
  {/snippet}
</Story>
