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

    const workspaceHeader = page.locator("[data-slot=studio-workspace-header]");
    await expect(
      workspaceHeader.getByRole("button", {
        name: "Collapse sidebar to project rail",
      }),
    ).toBeVisible();
    const expandedWidth = await getSidebarWidth(page);
    await workspaceHeader
      .getByRole("button", { name: "Collapse sidebar to project rail" })
      .click();
    await expect(
      page.getByRole("button", { name: "Expand project rail" }),
    ).toBeVisible({ timeout: 10_000 });
    const collapsedWidth = await getSidebarWidth(page);
    expect(collapsedWidth).toBeLessThan(expandedWidth);
    await expect(
      page.getByRole("button", { name: "Expand project rail" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Expand project rail" }).click();
    await expect(
      workspaceHeader.getByRole("button", {
        name: "Collapse sidebar to project rail",
      }),
    ).toBeVisible({ timeout: 10_000 });

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

  test("applies tree-table, scroll-container, and grouped journal styles", async ({
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
    await expect(page).toHaveURL(/#\/journal\?ledger=.+$/);
    await expect(page.locator("[data-journal-table]")).toBeVisible({
      timeout: 15_000,
    });

    const headerBackground = await page
      .locator("[data-journal-table] > div > div")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(headerBackground).not.toBe("rgba(0, 0, 0, 0)");

    const groupRadius = await page
      .locator("[data-journal-table] section[aria-labelledby]")
      .first()
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(parseFloat(groupRadius)).toBeGreaterThan(0);
  });

  test("styles Account Changes and Balances as interval tables", async ({
    page,
  }) => {
    await page.goto("/#/account/Expenses");
    const changesTab = page.getByRole("tab", { name: "Changes (Monthly)" });
    await expect(changesTab).toBeVisible({ timeout: 15_000 });
    await changesTab.click();
    await expect(changesTab).toHaveAttribute("aria-selected", "true");

    const intervalTable = page.locator("[data-interval-tree-table]:visible");
    await expect(intervalTable).toHaveCount(1);
    const intervalTableFont = await intervalTable.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    expect(intervalTableFont.toLowerCase()).toContain("source code pro");
    const intervalTableFontSize = await intervalTable.evaluate(
      (el) => getComputedStyle(el).fontSize,
    );
    expect(parseFloat(intervalTableFontSize)).toBe(14);

    const intervalHeader = intervalTable.locator(".head p > span").first();
    const intervalHeaderBackground = await intervalHeader.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(intervalHeaderBackground).not.toBe("rgba(0, 0, 0, 0)");

    const intervalCellBorders = await intervalHeader.evaluate((el) => {
      const firstDataCell = el
        .closest("ol")
        ?.querySelector("li:not(.head) p > span");
      if (!firstDataCell)
        throw new Error("Interval table data cell is missing");
      return {
        headerTop: getComputedStyle(el).borderTopWidth,
        headerBottom: getComputedStyle(el).borderBottomWidth,
        dataTop: getComputedStyle(firstDataCell).borderTopWidth,
        dataBottom: getComputedStyle(firstDataCell).borderBottomWidth,
        rowMarginTop: getComputedStyle(firstDataCell.parentElement!).marginTop,
      };
    });
    expect(parseFloat(intervalCellBorders.headerTop)).toBeGreaterThan(0);
    expect(parseFloat(intervalCellBorders.headerBottom)).toBeGreaterThan(0);
    expect(parseFloat(intervalCellBorders.dataTop)).toBe(0);
    expect(parseFloat(intervalCellBorders.dataBottom)).toBeGreaterThan(0);
    expect(parseFloat(intervalCellBorders.rowMarginTop)).toBe(0);

    const branchBoundaryBorder = await intervalTable.evaluate((table) => {
      const branchBoundaryAccountCell = table.querySelector(
        "li:has(> ol) + li > p > [data-account-name]",
      );
      if (!branchBoundaryAccountCell) {
        throw new Error("Branch boundary account cell is missing");
      }
      return {
        borderTop: getComputedStyle(branchBoundaryAccountCell).borderTopWidth,
        segmentHeight: getComputedStyle(branchBoundaryAccountCell, "::before")
          .height,
        segmentTop: getComputedStyle(branchBoundaryAccountCell, "::before").top,
        segmentWidth: getComputedStyle(branchBoundaryAccountCell, "::before")
          .width,
      };
    });
    expect(parseFloat(branchBoundaryBorder.borderTop)).toBe(0);
    expect(parseFloat(branchBoundaryBorder.segmentHeight)).toBe(1);
    expect(parseFloat(branchBoundaryBorder.segmentTop)).toBe(-1);
    expect(parseFloat(branchBoundaryBorder.segmentWidth)).toBeGreaterThan(0);

    const headerCells = intervalTable.locator(".head p > span");
    expect(await headerCells.count()).toBeGreaterThan(1);
    const adjacentHeaderCell = headerCells.nth(1);
    const sharedEdge = await adjacentHeaderCell.evaluate((el) => ({
      left: getComputedStyle(el).borderLeftWidth,
      previousRight: getComputedStyle(el.previousElementSibling!)
        .borderRightWidth,
      previousMarginRight: getComputedStyle(el.previousElementSibling!)
        .marginRight,
    }));
    expect(parseFloat(sharedEdge.left)).toBe(1);
    expect(parseFloat(sharedEdge.previousRight)).toBe(1);
    expect(parseFloat(sharedEdge.previousMarginRight)).toBe(-1);

    const accountCellOffsets = await intervalTable
      .locator("[data-account-name]")
      .evaluateAll((cells) =>
        cells.map((cell) => cell.getBoundingClientRect().left),
      );
    expect(Math.max(...accountCellOffsets)).toBeGreaterThan(
      Math.min(...accountCellOffsets),
    );

    const stickyColumnState = await intervalTable.evaluate((table) => {
      const viewport = table.closest("[data-scroll-area-content]")
        ?.parentElement as HTMLElement | null;
      const headerCell = table.querySelector(".head p > span");
      if (!viewport || !headerCell) {
        throw new Error("Interval table scroll viewport is unavailable");
      }

      viewport.scrollLeft = 240;
      const state = {
        scrollLeft: viewport.scrollLeft,
        viewportLeft: viewport.getBoundingClientRect().left,
        headerLeft: headerCell.getBoundingClientRect().left,
        accountOffsets: Array.from(
          table.querySelectorAll("[data-account-name]"),
        ).map((cell) => cell.getBoundingClientRect().left),
      };
      viewport.scrollLeft = 0;
      return state;
    });
    expect(stickyColumnState.scrollLeft).toBeGreaterThan(0);
    expect(
      Math.abs(stickyColumnState.headerLeft - stickyColumnState.viewportLeft),
    ).toBeLessThanOrEqual(1);
    expect(Math.max(...stickyColumnState.accountOffsets)).toBeGreaterThan(
      Math.min(...stickyColumnState.accountOffsets),
    );

    const indentMask = await intervalTable
      .locator("[data-account-name]")
      .evaluateAll((cells) => {
        const nestedCell = cells.find(
          (cell) => parseFloat(getComputedStyle(cell).marginLeft) > 0,
        );
        if (!nestedCell) return undefined;
        return {
          boxShadow: getComputedStyle(nestedCell).boxShadow,
        };
      });
    if (!indentMask) throw new Error("Nested account indent mask is missing");
    expect(indentMask.boxShadow).not.toBe("none");

    const dimmedCells = intervalTable.locator(".dimmed");
    expect(await dimmedCells.count()).toBeGreaterThan(0);
    const dimmedOpacity = await dimmedCells
      .nth(0)
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(dimmedOpacity).toBe("0.8");

    const intervalExpander = intervalTable
      .locator(".clickable-icon svg")
      .first();
    await expect(intervalExpander).toBeVisible();
    const intervalIconSize = await intervalExpander.evaluate((el) => ({
      width: getComputedStyle(el).width,
      height: getComputedStyle(el).height,
    }));
    expect(parseFloat(intervalIconSize.width)).toBe(12);
    expect(parseFloat(intervalIconSize.height)).toBe(12);

    const balancesTab = page.getByRole("tab", { name: "Balances (Monthly)" });
    await balancesTab.click();
    await expect(balancesTab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator("[data-interval-tree-table]:visible"),
    ).toHaveCount(1);
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
