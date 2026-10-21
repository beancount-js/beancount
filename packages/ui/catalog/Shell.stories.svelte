<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import { expectHeaderActionsRight } from "./header-assertions";
  import { expectContainedShell } from "./layout-assertions";
  const { Story } = defineMeta({
    title: "Beancount/Shell",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
  async function sidebarControls({
    canvasElement,
  }: {
    canvasElement: HTMLElement;
  }) {
    const canvas = within(canvasElement);
    async function click(control: HTMLElement) {
      if (import.meta.env.MODE === "test") {
        const { page } = await import("vitest/browser");
        await page.elementLocator(control).click();
      } else await userEvent.click(control);
    }
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    const header = canvas.getByRole("navigation", {
      name: "Application navigation",
    });
    expect(header).not.toHaveTextContent("Beancount Studio");
    expect(getComputedStyle(header).backgroundColor).toBe(
      getComputedStyle(
        canvasElement.querySelector<HTMLElement>(".beancount-shell__surface")!,
      ).backgroundColor,
    );
    const left = header.querySelector<HTMLElement>(
      '[data-ui-part="sidebar-toggle"][data-side="left"]',
    )!;
    const right = header.querySelector<HTMLElement>(
      '[data-ui-part="sidebar-toggle"][data-side="right"]',
    )!;
    for (const toggle of [left, right]) {
      expect(
        toggle.querySelector('[data-ui-part="sidebar-toggle-icon"]'),
      ).toBeVisible();
    }
    expect(right.getBoundingClientRect().right).toBeGreaterThan(
      header.getBoundingClientRect().right - 12,
    );
    const expanded = left.getAttribute("aria-expanded") === "true";
    await click(left);
    await expect(left).toHaveAttribute("aria-expanded", String(!expanded));
    await click(left);
    await expect(left).toHaveAttribute("aria-expanded", String(expanded));
    await click(right);
    await expect(
      await canvas.findByRole("textbox", { name: "Ask ledger assistant" }),
    ).toBeVisible();
    await expect(right).toHaveAttribute("aria-expanded", "true");
    await click(
      canvasElement.querySelector<HTMLElement>(
        '[data-ui-part="sidebar-close"][data-side="right"]',
      )!,
    );
    await waitFor(() =>
      expect(right).toHaveAttribute("aria-expanded", "false"),
    );
    await click(right);
    await expect(
      await canvas.findByRole("textbox", { name: "Ask ledger assistant" }),
    ).toBeVisible();
    await expect(right).toHaveAttribute("aria-expanded", "true");
    await click(right);
    await waitFor(() =>
      expect(right).toHaveAttribute("aria-expanded", "false"),
    );
    await expect(
      canvas.getByRole("heading", { name: "Financial dashboard" }),
    ).toBeVisible();
    await expectContainedShell(canvasElement);
  }
</script>

<Story
  name="Mobile header actions"
  play={async ({ canvasElement }) => {
    await within(canvasElement).findByRole("region", { name: "Sources" });
    await expectHeaderActionsRight(canvasElement);
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<div style="width: 390px; max-width: 100%; height: 100%">
      <ApplicationHarness initialRoute="/import/editor" displayMode="mobile" />
    </div>{/snippet}
</Story>

<Story
  name="Desktop sidebar controls"
  globals={{ theme: "default" }}
  play={sidebarControls}
>
  {#snippet template()}<ApplicationHarness displayMode="desktop" />{/snippet}
</Story>
<Story
  name="Mobile sidebar controls"
  globals={{ colorMode: "dark" }}
  play={sidebarControls}
>
  {#snippet template()}<div style="width: 390px; max-width: 100%; height: 100%">
      <ApplicationHarness displayMode="mobile" />
    </div>{/snippet}
</Story>
<Story name="Constrained desktop sidebar controls" play={sidebarControls}>
  {#snippet template()}<div style="width: 700px; max-width: 100%; height: 100%">
      <ApplicationHarness displayMode="desktop" />
    </div>{/snippet}
</Story>
