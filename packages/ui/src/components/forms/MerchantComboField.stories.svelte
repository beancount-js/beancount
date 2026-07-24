<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import FormField from "./FormField.svelte";
  import MerchantComboField from "./MerchantComboField.svelte";
  import type { FormCustomRenderer } from "./types";
  import type { MerchantPickerMerchant } from "./MerchantPicker.svelte";

  type MerchantRoot = {
    id: string;
    name: string;
    merchantId: string;
  };

  const merchants: readonly MerchantPickerMerchant[] = [
    {
      merchantId: "northstar-cafe",
      canonicalName: "Northstar Cafe",
      domain: "northstar-cafe.example",
      description: "Coffee and lunch purchases",
    },
    {
      merchantId: "grocerly",
      canonicalName: "Grocerly",
      domain: "grocerly.example",
      description: "Household shopping",
    },
  ];

  const context = { accounts: [], merchants };
  const field = {
    id: "merchantId",
    label: "Merchant",
  };
  const MerchantField = MerchantComboField as FormCustomRenderer<
    MerchantRoot,
    typeof context,
    string
  >;

  const { Story } = defineMeta({
    title: "UI Forms/Merchant Combo Field",
    component: MerchantComboField,
    parameters: {
      docs: {
        description: {
          component:
            "A reusable source-form merchant selector that renders a centered field around a saved-merchant list. Applications supply the merchant catalog through form context and keep route, project, and API behavior in their own adapters.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let root = $state<MerchantRoot>({
    id: "demo-source",
    name: "Demo bank connection",
    merchantId: "",
  });
</script>

<Story
  name="Selects a saved merchant"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Merchant" }));
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole("option", { name: /Grocerly/ }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("Grocerly");
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="center">
        <MerchantField
          {root}
          value={root.merchantId ?? ""}
          {field}
          {context}
          issues={[]}
          view="edit"
          readonly={false}
          update={(value) => {
            root = { ...root, merchantId: value };
          }}
          updateRoot={(value) => {
            root = value as MerchantRoot;
          }}
        />
      </FormField>
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Merchant: {merchants.find(
          (merchant) => merchant.merchantId === root.merchantId,
        )?.canonicalName ?? "Not selected"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows a read-only merchant">
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="center">
        <MerchantField
          {root}
          value="grocerly"
          {field}
          {context}
          issues={[]}
          view="readonly"
          readonly={true}
          update={() => {}}
          updateRoot={() => {}}
        />
      </FormField>
    </div>
  {/snippet}
</Story>
