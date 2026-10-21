<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within, userEvent, waitFor } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import { expectHeaderActionsRight } from "./header-assertions";
  const { Story } = defineMeta({
    title: "Beancount/Editing and discovery",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
</script>

<Story
  name="Journal"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Groceries/)).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      initialRoute="/journal"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story name="Account"
  >{#snippet template()}<ApplicationHarness
      initialRoute="/account/Assets:Checking"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Editor"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", {
      name: "Ledger source",
    });
    await expectHeaderActionsRight(canvasElement);
    expect(
      canvas
        .getByRole("toolbar", { name: "Editor commands" })
        .closest("[data-page-toolbar-leading]"),
    ).not.toBeNull();
    await userEvent.click(editor);
    const modifier = /Mac/.test(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${modifier}>}a{/${modifier}}`);
    await userEvent.type(
      editor,
      'option "operating_currency" "GBP"\n2024-01-01 open Assets:Checking GBP\n2024-01-01 open Equity:Opening GBP\n2024-01-02 * "Storybook balance"\n  Assets:Checking 25 GBP\n  Equity:Opening -25 GBP\n',
      { skipClick: true },
    );
    const save = canvas.getByRole("button", { name: "Save ledger" });
    await userEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    await userEvent.click(canvas.getByRole("button", { name: "Dashboard" }));
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await expect(
      within(
        within(
          canvas.getByRole("region", { name: "Period summary" }),
        ).getByText("Net worth", { exact: true }).parentElement!,
      ).getByText("25.00 GBP"),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      initialRoute="/editor"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story name="Query"
  >{#snippet template()}<ApplicationHarness
      initialRoute="/query?qs=SELECT%20account%2C%20sum(number)%20GROUP%20BY%20account"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Resource"
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Example receipt/),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      initialRoute="/resource?path=receipts/example.txt"
      displayMode="desktop"
    />{/snippet}</Story
>
