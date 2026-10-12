<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within, userEvent, waitFor } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Ingestion and settings",
    component: BeancountApplication,
  });
  async function ready(canvasElement: HTMLElement, name: string) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("region", { name })).toBeVisible();
  }
</script>

<Story
  name="Records"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Records");
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Review Example bookshop" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Accept 1 ready transaction" }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Accept 1 ready transaction" }),
    );
    await expect(
      await canvas.findByText("Accepted 1 transaction."),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/records"
    />{/snippet}</Story
>
<Story
  name="Sources"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Sources");
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Example bank" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Switch to edit mode" }),
    );
    const endpoint = await canvas.findByRole("textbox", {
      name: "Endpoint",
    });
    await expect(endpoint).toHaveValue("https://api.example.com/transactions");
    const region = canvas.getByRole("region", { name: "Sources" });
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
    const recordsPath = canvas.getByRole("textbox", { name: "Records path" });
    await expect(
      Math.abs(
        endpoint.getBoundingClientRect().left -
          recordsPath.getBoundingClientRect().left,
      ),
    ).toBeLessThan(2);
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse all source sections" }),
    );
    await expect(endpoint).not.toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand all source sections" }),
    );
    await expect(
      await canvas.findByRole("textbox", { name: "Endpoint" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("switch", { name: "YAML mode" }));
    await expect(
      await canvas.findByRole("textbox", {
        name: "Ingestion sources YAML editor",
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/editor"
    />{/snippet}</Story
>
<Story
  name="Linked Accounts"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Linked Accounts");
    await expect(
      await within(canvasElement).findByText("Fixture provider", {
        exact: true,
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/accounts"
    />{/snippet}</Story
>
<Story
  name="Review Merchants"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Review Merchants");
    await expect(
      await within(canvasElement).findByText("Example bookshop", {
        exact: true,
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/merchants"
    />{/snippet}</Story
>
<Story
  name="Manage Merchants"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Manage Merchants");
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Example cafe/ }),
    );
    const dialog = within(document.body);
    const name = await dialog.findByRole("textbox", { name: "Merchant name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Renamed cafe");
    await expect(
      await dialog.findByText("Saved.", {}, { timeout: 5000 }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/manage-merchants"
    />{/snippet}</Story
>
<Story
  name="Brand Match"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Brand Match");
    await expect(
      await within(canvasElement).findByRole("switch", { name: /brand/i }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/brands"
    />{/snippet}</Story
>
<Story
  name="Import History"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Import History");
    await expect(
      await within(canvasElement).findByRole("link", {
        name: "Review Example bank",
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/history"
    />{/snippet}</Story
>
<Story
  name="Rules"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Rules");
    await expect(
      await within(canvasElement).findByText("Categorise coffee", {
        exact: true,
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/rules"
    />{/snippet}</Story
>
<Story
  name="Run audit"
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("heading", { name: "Proposals" }),
    ).toBeVisible();
    await expect(
      await within(canvasElement).findByText("Example cafe", { exact: true }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/import/history/import-2024"
    />{/snippet}</Story
>
