<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import {
    FormField,
    type FormCustomRenderer,
    type FormFieldConfig,
  } from "@beancount-js/forms";
  import type { SourceFormContext } from "../../ingestion/source-form-config";
  import MerchantComboField from "./MerchantComboField.svelte";

  const merchants = [
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

  const context: SourceFormContext = { accounts: [], projectId: "demo" };
  type MerchantRoot = { id: string; name: string; merchantId: string };
  const field: FormFieldConfig<MerchantRoot, SourceFormContext, string> = {
    id: "merchantId",
    label: "Merchant",
    kind: "custom",
    as: "div",
    align: "center",
    get: (root) => root.merchantId,
    set: (root, merchantId) => ({ ...root, merchantId }),
  };
  const MerchantField = MerchantComboField as FormCustomRenderer<
    MerchantRoot,
    SourceFormContext,
    string
  >;

  const { Story } = defineMeta({
    title: "Fava/Forms/Merchant Combo Field",
    component: MerchantComboField,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's source-form adapter that supplies the selected source identity and project context to Merchant Picker. It is a centered structured-form field, with deterministic catalog data for saved merchants. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the surrounding form treatment.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { onDestroy } from "svelte";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/api/projects/demo/ingestion/merchants")) {
      return new Response(JSON.stringify(merchants), {
        headers: { "content-type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };

  onDestroy(() => {
    globalThis.fetch = originalFetch;
  });

  let root = $state<MerchantRoot>({
    id: "demo-source",
    name: "Demo bank connection",
    merchantId: "",
  });

  function update(value: string) {
    root = field.set?.(root, value, context) ?? root;
  }
</script>

<Story
  name="Associates a source with a saved merchant"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Merchant" }));
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole("option", { name: /Northstar Cafe/ }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Northstar Cafe",
    );
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
          {update}
          updateRoot={(value) => {
            root = value;
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

<Story name="Shows the saved merchant when read-only">
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
          {update}
          updateRoot={() => {}}
        />
      </FormField>
    </div>
  {/snippet}
</Story>
