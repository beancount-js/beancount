import { expect, test } from "@playwright/test";
import {
  appendEditorLine,
  getSidebarWidth,
  mainTabs,
  minimalLedger,
  navigateTo,
  openEditor,
  seedLedger,
  waitForEditorContent,
} from "./helpers";

test.describe("app workflow", () => {
  test("loads saved ledger, persists edits, renders all tabs, and collapses sidebar", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await seedLedger(page, minimalLedger);
    await openEditor(page);
    await waitForEditorContent(page, "E2E Test Ledger");

    await appendEditorLine(page, "; saved-by-e2e");

    const stored = await page.evaluate(() => localStorage.getItem("ledger"));
    expect(stored).toContain("saved-by-e2e");
    expect(stored).toContain("Coffee Shop");

    await expect(page.getByRole("button", { name: "Collapse" })).toBeVisible();
    const expandedWidth = await getSidebarWidth(page);
    await page.getByRole("button", { name: "Collapse" }).click();
    await expect(page.getByRole("button", { name: "Expand" })).toBeVisible({
      timeout: 10_000,
    });
    const collapsedWidth = await getSidebarWidth(page);
    expect(collapsedWidth).toBeLessThan(expandedWidth);
    await expect(
      page.locator(".h-screen nav a[href='#/editor']").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Expand" }).click();
    await expect(page.getByRole("button", { name: "Collapse" })).toBeVisible({
      timeout: 10_000,
    });

    for (const tab of mainTabs) {
      await navigateTo(page, tab.name);
      await expect(page).toHaveURL(tab.path);
      await tab.assert(page);
    }

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("ported styles", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, minimalLedger);
  });

  test("applies tree-table, scroll-container, and journal-table styles", async ({
    page,
  }) => {
    await page.goto("/#/income_statement");
    await expect(page.locator(".tree-table-new").first()).toBeVisible();

    const numWidth = await page
      .locator(".tree-table-new .num")
      .first()
      .evaluate((el) => getComputedStyle(el).width);
    expect(parseFloat(numWidth)).toBeGreaterThan(100);

    const cellBorder = await page
      .locator(".tree-table-new p > span")
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(cellBorder)).toBeGreaterThan(0);

    const expanderIcon = page
      .locator(".tree-table-new .clickable-icon svg")
      .first();
    if (await expanderIcon.count()) {
      const iconSize = await expanderIcon.evaluate((el) => ({
        width: getComputedStyle(el).width,
        height: getComputedStyle(el).height,
      }));
      expect(parseFloat(iconSize.width)).toBeLessThanOrEqual(13);
      expect(parseFloat(iconSize.height)).toBeLessThanOrEqual(13);
    }

    const tableFont = await page
      .locator(".tree-table-new")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(tableFont.toLowerCase()).toContain("source code pro");

    const scrollOverflow = await page
      .locator(".scroll-container")
      .first()
      .evaluate((el) => getComputedStyle(el).overflowY);
    expect(scrollOverflow).toBe("auto");

    await navigateTo(page, "Journal");
    await expect(page).toHaveURL(/#\/journal$/);
    await expect(page.locator(".bean-table.flex-table")).toBeVisible({
      timeout: 15_000,
    });

    const headerBackground = await page
      .locator(".bean-table.flex-table .head p > span")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(headerBackground).not.toBe("rgba(0, 0, 0, 0)");

    const monoFont = await page
      .locator(".bean-table.flex-table .num")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(monoFont.toLowerCase()).toMatch(/mono|menlo|consolas/);
  });

  test("loads codemirror theme styles", async ({ page }) => {
    await page.goto("/#/editor");
    await waitForEditorContent(page, "E2E Test Ledger");

    const editorFont = await page
      .locator(".beancount-editor .cm-content")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(editorFont.toLowerCase()).toMatch(/source code pro|mono|monospace/);
  });
});
