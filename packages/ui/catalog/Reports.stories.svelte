<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Reports",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
  async function ready(canvasElement: HTMLElement, name: string) {
    const canvas = within(canvasElement);
    const region = await canvas.findByRole("region", { name });
    await expect(region).toBeVisible();
    await expect(region.children.length).toBeGreaterThan(0);
    const report = within(region);
    if (name === "Income Statement")
      await expect(report.getByRole("link", { name: "Salary" })).toBeVisible();
    if (name === "Balance Sheet" || name === "Trial Balance")
      await expect(
        report.getByRole("link", { name: "Checking" }),
      ).toBeVisible();
    if (name === "Holdings")
      await expect(report.getByRole("tab", { name: "Holdings" })).toBeVisible();
    if (name === "Statistics")
      await expect(
        report.getByRole("tab", { name: "Postings per Account" }),
      ).toBeVisible();
    if (name === "Errors")
      await expect(report.getByText("No records")).toBeVisible();
  }
</script>

<Story
  name="Income Statement"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Income Statement");
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/income_statement"
    />{/snippet}</Story
>
<Story
  name="Balance Sheet"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Balance Sheet");
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/balance_sheet"
    />{/snippet}</Story
>
<Story
  name="Trial Balance"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Trial Balance");
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/trial_balance"
    />{/snippet}</Story
>
<Story
  name="Holdings"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Holdings");
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/holdings"
    />{/snippet}</Story
>
<Story
  name="Statistics"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Statistics");
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/statistics"
    />{/snippet}</Story
>
<Story
  name="Errors"
  play={async ({ canvasElement }) => {
    await ready(canvasElement, "Errors");
  }}
  >{#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/errors"
    />{/snippet}</Story
>
