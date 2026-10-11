<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Application",
    component: BeancountApplication,
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          code: 'import { BeancountApplication } from "@beancount-js/ui";\n<BeancountApplication {controller} />',
        },
      },
    },
  });
</script>

<Story
  name="Dashboard"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: "Financial dashboard" }),
    ).toBeVisible();
    await expect(
      within(
        canvas.getByText("Income", { exact: true }).parentElement!,
      ).getByText("6000.00 GBP"),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse left sidebar" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand left sidebar" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}<ApplicationHarness displayMode="desktop" />{/snippet}
</Story>
<Story name="Mobile">
  {#snippet template()}<ApplicationHarness displayMode="mobile" />{/snippet}
</Story>
