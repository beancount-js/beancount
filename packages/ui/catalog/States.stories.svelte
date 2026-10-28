<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Application states",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
</script>

<Story
  name="Loading"
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("status"),
    ).toHaveTextContent("Loading ledger");
  }}
  >{#snippet template()}<ApplicationHarness
      scenario="loading"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Empty"
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("No ledger files"),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      scenario="empty"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Error and retry"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(
      await canvas.findByRole("heading", { name: "Financial dashboard" }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      scenario="error"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Dark dashboard"
  globals={{ colorMode: "dark" }}
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("heading", {
        name: "Financial dashboard",
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Ledger root alias"
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("region", {
        name: "Balance Sheet",
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      initialRoute="/"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Directives alias"
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("textbox", {
        name: "Ledger source",
      }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      initialRoute="/directives"
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Project isolation"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", {
      name: "Ledger source",
    });
    await userEvent.click(editor);
    const modifier = /Mac/.test(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${modifier}>}a{/${modifier}}`);
    await userEvent.type(editor, 'option "title" "Isolated edit"\n', {
      skipClick: true,
    });
    const save = canvas.getByRole("button", { name: "Save ledger" });
    await userEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    await userEvent.click(canvas.getByRole("radio", { name: "Projects" }));
    await userEvent.click(
      canvas.getByRole("button", { name: /^Second Project/ }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("textbox", { name: "Ledger source" }),
      ).toHaveTextContent("Example Ledger"),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Ledger source" }),
    ).not.toHaveTextContent("Isolated edit");

    await userEvent.click(
      canvas.getByRole("button", { name: /^Example Ledger/ }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("textbox", { name: "Ledger source" }),
      ).toHaveTextContent("Isolated edit"),
    );
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/editor"
    />{/snippet}</Story
>
<Story
  name="Dark editor"
  globals={{ colorMode: "dark" }}
  play={async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("textbox", {
        name: "Ledger source",
      }),
    ).toHaveTextContent("Example Ledger");
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/editor"
    />{/snippet}</Story
>
