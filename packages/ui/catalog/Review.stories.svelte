<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import { expectContainedShell } from "./layout-assertions";
  const { Story } = defineMeta({
    title: "Beancount/Review",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
</script>

<Story
  name="Shared project"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await userEvent.click(
      canvas.getByRole("button", { name: /^Dashboard period:/ }),
    );
    await userEvent.click(
      await within(document.body).findByRole("option", { name: "All time" }),
    );
    await expectContainedShell(canvasElement);
    await waitFor(() => {
      expect(
        getComputedStyle(canvas.getByRole("button", { name: "Journal" }))
          .pointerEvents,
      ).not.toBe("none");
    });
    await userEvent.click(canvas.getByRole("button", { name: "Journal" }));
    await expect(
      await canvas.findByRole("radio", { name: "Transactions" }),
    ).toBeVisible();
    await expectContainedShell(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Balance Sheet" }),
    );
    await expect(
      await canvas.findByRole("region", { name: "Balance Sheet" }),
    ).toBeVisible();
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
    />{/snippet}
</Story>

<Story
  name="Matching preview"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await expect(
      canvas.getByText("beancount-js-studio-query-table-498bd075", {
        selector: "[data-project-name]",
      }),
    ).toBeVisible();
    expect(
      canvasElement.querySelectorAll("[data-ledger-file-row]"),
    ).toHaveLength(5);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Dashboard period:/ }),
    );
    await userEvent.click(
      await within(document.body).findByRole("option", { name: "All time" }),
    );
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="preview"
      displayMode="desktop"
    />{/snippet}
</Story>
