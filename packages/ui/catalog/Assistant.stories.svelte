<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Assistant",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
  async function propose(canvasElement: HTMLElement) {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle AI panel" }),
    );
    const input = await canvas.findByRole("textbox", {
      name: "Ask ledger assistant",
    });
    await userEvent.type(input, "Clarify the ledger title");
    await userEvent.click(canvas.getByRole("button", { name: "Ask AI" }));
    await expect(
      await canvas.findByRole("heading", { name: "Clarify ledger title" }),
    ).toBeVisible();
    return canvas;
  }
</script>

<Story
  name="Keep proposed change"
  play={async ({ canvasElement }) => {
    const canvas = await propose(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Keep change" }));
    await expect(
      await canvas.findByText("kept", { exact: true }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Editor" }));
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[role="textbox"][contenteditable="true"]'),
      ).toHaveTextContent(" · reviewed"),
    );
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Undo proposed change"
  play={async ({ canvasElement }) => {
    const canvas = await propose(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Undo proposal" }),
    );
    await expect(
      await canvas.findByText("undone", { exact: true }),
    ).toBeVisible();
    await userEvent.click(canvas.getByLabelText("AI settings"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear this chat" }),
    );
    const dialog = within(document.body);
    await dialog.findByRole("alertdialog", { name: "Clear ledger AI chat?" });
    await userEvent.click(dialog.getByRole("button", { name: "Clear chat" }));
    await expect(
      await canvas.findByText(
        /Ask about the ledger, or ask for a proposed change/,
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(getComputedStyle(document.body).pointerEvents).not.toBe("none"),
    );
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
    />{/snippet}</Story
>
<Story
  name="Mobile assistant"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle AI panel" }),
    );
    await expect(
      await canvas.findByRole("textbox", { name: "Ask ledger assistant" }),
    ).toBeVisible();
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="mobile"
    />{/snippet}</Story
>
