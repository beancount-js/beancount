<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Sheets",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });

  async function bulkSheet({ canvasElement }: { canvasElement: HTMLElement }) {
    const canvas = within(canvasElement);
    const selection = await canvas.findByRole("checkbox", {
      name: "Select Savings transfer",
    });
    await waitFor(() =>
      expect(getComputedStyle(selection).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(selection);
    const edit = await canvas.findByRole("button", {
      name: "Edit 1 selected records",
    });
    await userEvent.click(edit);
    const sheet = await within(document.body).findByRole("dialog", {
      name: "Bulk actions",
    });
    const body = within(sheet);
    expect(body.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    const header = sheet.querySelector<HTMLElement>(
      '[data-ui-part="sheet-header"]',
    )!;
    const title = body.getByRole("heading", { name: "Bulk actions" });
    const close = body.getByRole("button", { name: "Close" });
    await waitFor(() => {
      const s = sheet.getBoundingClientRect();
      const h = header.getBoundingClientRect();
      const c = close.getBoundingClientRect();
      expect(
        Math.abs(s.width - Math.min(window.innerWidth, 672)),
      ).toBeLessThanOrEqual(1);
      expect(Math.abs(s.right - window.innerWidth)).toBeLessThanOrEqual(1);
      expect(h.height).toBe(44);
      expect(c.width).toBe(32);
      expect(c.height).toBe(32);
      expect(
        Math.abs(c.top + c.height / 2 - (h.top + h.height / 2)),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(title.getBoundingClientRect().left - h.left - 12),
      ).toBeLessThanOrEqual(1);
      expect(sheet.scrollWidth).toBeLessThanOrEqual(sheet.clientWidth + 1);
    });
    expect(document.activeElement).toBe(title);
    await userEvent.click(body.getByRole("button", { name: "Collapse all" }));
    expect(body.queryByRole("button", { name: "Apply" })).toBeNull();
    await userEvent.click(body.getByRole("button", { name: "Expand all" }));
    await expect(body.getByRole("button", { name: "Apply" })).toBeVisible();
    const picker = body.getByRole("button", { name: /^Account to replace:/ });
    await expect(picker).toBeVisible();
    expect(
      getComputedStyle(body.getByRole("button", { name: "Replace" })).fontSize,
    ).toBe("12px");
    await userEvent.click(close);
    await waitFor(() => {
      expect(within(document.body).queryByRole("dialog")).toBeNull();
      expect(getComputedStyle(edit).pointerEvents).not.toBe("none");
    });
    expect(document.activeElement).toBe(edit);
    await userEvent.click(edit);
    await within(document.body).findByRole("dialog", { name: "Bulk actions" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(within(document.body).queryByRole("dialog")).toBeNull();
      expect(getComputedStyle(edit).pointerEvents).not.toBe("none");
    });
    // Leave the sheet open for catalog review and accessibility qualification.
    await userEvent.click(edit);
    await within(document.body).findByRole("dialog", { name: "Bulk actions" });
  }
</script>

<Story name="Journal bulk actions" play={bulkSheet}>
  {#snippet template()}<ApplicationHarness initialRoute="/journal" />{/snippet}
</Story>
<Story
  name="Dark journal bulk actions"
  globals={{ colorMode: "dark" }}
  play={bulkSheet}
>
  {#snippet template()}<ApplicationHarness initialRoute="/journal" />{/snippet}
</Story>
<Story
  name="Mobile journal bulk actions"
  play={async (context) => {
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      const original = { width: window.innerWidth, height: window.innerHeight };
      await page.viewport(390, 844);
      try {
        await bulkSheet(context);
      } finally {
        await page.viewport(original.width, original.height);
      }
    } else await bulkSheet(context);
  }}
>
  {#snippet template()}<ApplicationHarness
      initialRoute="/journal"
      displayMode="mobile"
    />{/snippet}
</Story>
