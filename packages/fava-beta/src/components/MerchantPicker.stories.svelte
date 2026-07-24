<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import MerchantPicker from "./MerchantPicker.svelte";

  const merchants = [
    {
      merchantId: "northstar-cafe",
      canonicalName: "Northstar Cafe",
      domain: "northstar-cafe.example",
      description: "Coffee and lunch purchases",
      aliases: [{ normalizedValue: "NORTHSTAR CAFE LONDON" }],
    },
    {
      merchantId: "grocerly",
      canonicalName: "Grocerly",
      domain: "grocerly.example",
      description: "Household shopping",
      aliases: [{ normalizedValue: "GROCERLY MARKET" }],
    },
  ];

  const { Story } = defineMeta({
    title: "Fava/Forms/Merchant Picker",
    component: MerchantPicker,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's saved-merchant picker for ingestion configuration. The catalog supplies a deterministic local merchant response so selection, ranking, and the empty option can be inspected without a project API. It builds on Filter Command Picker; see the [Form guidance](?path=/docs/ui-forms-guidance--docs) for picker and row usage.",
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

  let merchantId = $state("");
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
    <div class="flex max-w-2xl flex-col gap-3">
      <MerchantPicker
        projectId="demo"
        value={merchantId}
        label="Merchant"
        ariaLabel="Merchant"
        emptyOption={{
          label: "No merchant selected",
          description: "Leave this source without a saved merchant.",
        }}
        onChange={(value) => {
          merchantId = value;
        }}
      />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Merchant: {merchants.find(
          (merchant) => merchant.merchantId === merchantId,
        )?.canonicalName ?? "Not selected"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows the selected merchant in read-only mode">
  {#snippet template()}
    <div class="max-w-2xl">
      <MerchantPicker
        projectId="demo"
        value="northstar-cafe"
        label="Merchant"
        ariaLabel="Merchant"
        readOnly
      />
    </div>
  {/snippet}
</Story>
