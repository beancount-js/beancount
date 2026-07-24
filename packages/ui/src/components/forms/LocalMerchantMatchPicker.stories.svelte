<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import LocalMerchantMatchPicker from "./LocalMerchantMatchPicker.svelte";

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
    title: "UI Forms/Local Merchant Match Picker",
    component: LocalMerchantMatchPicker,
    parameters: {
      docs: {
        description: {
          component:
            "An app-owned merchant picker for the proposal/ingestion correction flow. It wraps `MerchantPicker` with a preconfigured `FormField`; applications provide the merchant list, any search action, and binding updates.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let merchantId = $state("");
  let selectedMerchant = $state("No merchant selected");
  let requestedAction = $state("None");

  function onAttach() {
    const selected = merchants.find((item) => item.merchantId === merchantId);
    selectedMerchant = selected?.canonicalName ?? "No merchant selected";
  }
</script>

<Story
  name="Selects a saved merchant"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Existing merchant" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole("option", { name: /Grocerly/ }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("Grocerly");
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form flex max-w-2xl flex-col gap-3">
      <LocalMerchantMatchPicker
        {merchants}
        value={merchantId}
        onChange={(value) => {
          merchantId = value;
        }}
        onAttach={() => onAttach()}
        domain="example.com"
      />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Attached merchant: {selectedMerchant}
      </output>
    </div>
  {/snippet}
</Story>

<Story
  name="Offers application search action"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Existing merchant" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(
      page.getByPlaceholderText("Search merchants..."),
      "corner-shop.example",
    );
    await userEvent.click(
      await page.findByRole("option", { name: /Create corner-shop.example/ }),
    );
    await expect(
      canvas.getByText("Requested merchant: corner-shop.example"),
    ).toBeInTheDocument();
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <LocalMerchantMatchPicker
        {merchants}
        value={merchantId}
        searchAction={(search) => ({
          label: `Create ${search} with Brand Match`,
          description: "The application can save a merchant with its logo.",
        })}
        onSearchAction={(search) => {
          requestedAction = search;
        }}
      />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Requested merchant: {requestedAction}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows selected merchant in read-only mode">
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <LocalMerchantMatchPicker {merchants} value="northstar-cafe" readOnly />
    </div>
  {/snippet}
</Story>
