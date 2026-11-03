<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Application",
    component: BeancountApplication,
    parameters: {
      beancountApplication: true,
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
      ).getByText("3000.00 GBP"),
    ).toBeVisible();
    await expect(
      canvas.getByText("Review Project", { selector: "[data-project-name]" }),
    ).toBeVisible();
    const shellBackground = getComputedStyle(
      canvasElement.querySelector<HTMLElement>(".ui-minimal-app-shell__main")!,
    ).backgroundColor;
    for (const surface of canvasElement.querySelectorAll<HTMLElement>(
      '[aria-label="Period summary"] > div, [data-dashboard-surface]',
    )) {
      expect(getComputedStyle(surface).backgroundColor).toBe(shellBackground);
    }
    const outflowRows = canvasElement.querySelectorAll<HTMLElement>(
      "[data-dashboard-outflow-row]",
    );
    expect(outflowRows.length).toBeGreaterThan(0);
    for (const row of outflowRows) {
      const category = row.firstElementChild!.lastElementChild!;
      const share = row.children[1]!;
      if (getComputedStyle(row.firstElementChild!).gridColumnEnd !== "span 2") {
        expect(category.getBoundingClientRect().right).toBeLessThanOrEqual(
          share.getBoundingClientRect().left + 1,
        );
      } else {
        expect(category.getBoundingClientRect().bottom).toBeLessThanOrEqual(
          share.getBoundingClientRect().top + 1,
        );
      }
    }
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse left sidebar" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand left sidebar" }),
    ).toBeVisible();
    const projectRail = canvas.getByRole("button", {
      name: "Expand project rail: Review Project",
    });
    await expect(projectRail).toBeVisible();
    expect(getComputedStyle(projectRail).margin).toBe("4px");
    const rail = projectRail.parentElement!.getBoundingClientRect();
    const railButton = projectRail.getBoundingClientRect();
    expect(railButton.left - rail.left).toBeGreaterThanOrEqual(4);
    expect(rail.right - railButton.right).toBeGreaterThanOrEqual(4);
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      const background = getComputedStyle(projectRail).backgroundColor;
      await page.elementLocator(projectRail).hover();
      await waitFor(() =>
        expect(getComputedStyle(projectRail).backgroundColor).not.toBe(
          background,
        ),
      );
      await page.elementLocator(projectRail).unhover();
    }
  }}
>
  {#snippet template()}<ApplicationHarness
      displayMode="desktop"
      scenario="review"
    />{/snippet}
</Story>
<Story name="Mobile">
  {#snippet template()}<ApplicationHarness displayMode="mobile" />{/snippet}
</Story>
