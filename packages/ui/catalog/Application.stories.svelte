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
    await userEvent.click(
      canvas.getByRole("button", { name: /^Dashboard period:/ }),
    );
    await userEvent.click(
      await within(document.body).findByRole("option", { name: "All time" }),
    );
    await expect(
      canvas.getByText("beancount-studio-catalog-preview", {
        selector: "[data-project-name]",
      }),
    ).toBeVisible();
    await expect(
      canvasElement.querySelector('[data-ledger-file-row="sample.beancount"]'),
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
    const flowScrollArea = canvasElement.querySelector<HTMLElement>(
      "[data-dashboard-flow-scroll-area]",
    )!;
    expect(flowScrollArea).toHaveAttribute("data-ui-component", "scroll-area");
    expect(
      flowScrollArea.querySelector('[data-ui-part="scroll-area-viewport"]'),
    ).toBeVisible();
    const collapseSidebar = canvas.getByRole("button", {
      name: "Collapse left sidebar",
    });
    await waitFor(() =>
      expect(getComputedStyle(collapseSidebar).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(collapseSidebar);
    await expect(
      canvas.getByRole("button", { name: "Expand left sidebar" }),
    ).toBeVisible();
    const projectRail = canvas.getByRole("button", {
      name: "Expand project rail: beancount-studio-catalog-preview",
    });
    await expect(projectRail).toBeVisible();
    expect(getComputedStyle(projectRail).margin).toBe("8px 6px");
    const rail = projectRail.parentElement!.getBoundingClientRect();
    const railButton = projectRail.getBoundingClientRect();
    expect(railButton.left - rail.left).toBeGreaterThanOrEqual(6);
    expect(rail.right - railButton.right).toBeGreaterThanOrEqual(6);
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      const background = getComputedStyle(projectRail).backgroundColor;
      const border = getComputedStyle(projectRail).borderColor;
      await page.elementLocator(projectRail).hover();
      await waitFor(() => {
        expect(getComputedStyle(projectRail).backgroundColor).not.toBe(
          background,
        );
        expect(getComputedStyle(projectRail).borderColor).not.toBe(border);
      });
      await page.elementLocator(projectRail).unhover();
    }
  }}
>
  {#snippet template()}<ApplicationHarness
      displayMode="desktop"
      scenario="preview"
    />{/snippet}
</Story>
<Story
  name="Route scroll resets"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("region", { name: "Journal" });
    const shellViewport = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="body-content"] > [data-ui-component="scroll-area"] > [data-ui-part="scroll-area-viewport"]',
    )!;
    expect(shellViewport.scrollHeight).toBeGreaterThan(
      shellViewport.clientHeight,
    );
    shellViewport.scrollTop = shellViewport.scrollHeight;
    await waitFor(() => expect(shellViewport.scrollTop).toBeGreaterThan(0));
    await userEvent.click(canvas.getByRole("button", { name: "Dashboard" }));
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await waitFor(() => {
      const routeContent = canvasElement.querySelector<HTMLElement>(
        '[data-ui-part="body-content"]',
      )!;
      const verticalScrollers = [
        routeContent,
        ...routeContent.querySelectorAll<HTMLElement>("*"),
      ].filter((element) => {
        const overflowY = getComputedStyle(element).overflowY;
        return overflowY === "auto" || overflowY === "scroll";
      });
      expect(verticalScrollers.length).toBeGreaterThan(0);
      for (const scroller of verticalScrollers) {
        expect(scroller.scrollTop).toBe(0);
      }
    });
  }}
>
  {#snippet template()}<ApplicationHarness
      initialRoute="/journal"
      displayMode="desktop"
      scenario="preview"
    />{/snippet}
</Story>
<Story name="Mobile">
  {#snippet template()}<ApplicationHarness displayMode="mobile" />{/snippet}
</Story>
