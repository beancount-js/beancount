import { expect, test } from "@playwright/test";
import {
  appendEditorLine,
  gotoStudio,
  mainTabs,
  minimalLedger,
  navigateTo,
  openEditor,
  readProjectLedger,
  restoreSampleLedger,
  sampleLedger,
  seedLedger,
  waitForEditorContent,
} from "./helpers";

test.describe("app workflow", () => {
  test.afterEach(async ({ page }) => {
    await restoreSampleLedger(page);
  });

  test("loads saved ledger, persists edits, renders all tabs, and collapses sidebar", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await seedLedger(page, minimalLedger);
    await openEditor(page);
    await waitForEditorContent(page, "E2E Test Ledger");

    await appendEditorLine(page, "; saved-by-e2e");

    const stored = await readProjectLedger(page);
    expect(stored).toContain("saved-by-e2e");
    expect(stored).toContain("Coffee Shop");

    const workspaceHeader = page.locator("[data-slot=studio-workspace-header]");
    await expect(
      workspaceHeader.getByRole("button", {
        name: "Collapse sidebar to project rail",
      }),
    ).toBeVisible();
    await workspaceHeader
      .getByRole("button", { name: "Collapse sidebar to project rail" })
      .click();
    await expect(
      page.getByRole("button", { name: "Expand project rail" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-collapsible=icon]").first()).toBeVisible();
    await page.getByRole("button", { name: "Expand project rail" }).click();
    await expect(
      workspaceHeader.getByRole("button", {
        name: "Collapse sidebar to project rail",
      }),
    ).toBeVisible({ timeout: 10_000 });

    for (const tab of mainTabs) {
      await navigateTo(page, tab.name);
      await expect(page).toHaveURL(tab.path);
      await expect(
        page.locator("[data-ledger-file-panels] button[aria-current=page]"),
      ).toHaveText(tab.name);
      await tab.assert(page);
    }

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("ported styles", () => {
  test.beforeEach(async ({ page }) => {
    // Hierarchy/interval style assertions need the full sample ledger.
    await seedLedger(page, sampleLedger);
  });

  test("aligns financial-statement hierarchy tables with account tables", async ({
    page,
  }) => {
    for (const path of [
      "/income_statement",
      "/balance_sheet",
      "/trial_balance",
    ]) {
      await gotoStudio(page, path);
      const statementTables = page.locator(
        "[data-statement-summary-tree-table]",
      );
      const statementTable = statementTables.first();
      await expect(statementTable).toBeVisible({ timeout: 15_000 });
      expect(await statementTables.count()).toBeGreaterThan(0);

      const tableStyles = await statementTable.evaluate((el) => ({
        borderRadius: getComputedStyle(el).borderRadius,
        borderTop: getComputedStyle(el).borderTopWidth,
      }));
      expect(parseFloat(tableStyles.borderRadius)).toBeGreaterThan(0);
      expect(parseFloat(tableStyles.borderTop)).toBeGreaterThan(0);

      const header = statementTable.locator("li").first();
      const headerStyles = await header.evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        fontSize: getComputedStyle(el).fontSize,
        textTransform: getComputedStyle(el).textTransform,
      }));
      expect(headerStyles.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(parseFloat(headerStyles.fontSize)).toBeLessThanOrEqual(14);
      expect(headerStyles.textTransform).toBe("uppercase");

      await statementTable
        .getByRole("button", { name: "Collapse all accounts", exact: true })
        .click();
      await expect(
        statementTable.getByRole("button", {
          name: "Expand all accounts",
          exact: true,
        }),
      ).toBeVisible();
      await statementTable
        .getByRole("button", { name: "Expand all accounts", exact: true })
        .click();

      const firstRow = statementTable
        .locator("[data-statement-summary-tree-row]")
        .first();
      const dataRowStyles = await firstRow.evaluate((el) => ({
        top: getComputedStyle(el).borderTopWidth,
        minHeight: getComputedStyle(el).minHeight,
      }));
      expect(parseFloat(dataRowStyles.top)).toBeGreaterThan(0);
      expect(parseFloat(dataRowStyles.minHeight)).toBeGreaterThanOrEqual(48);
      await expect(firstRow).toHaveClass(/hover:bg-muted/);

      if (path === "/trial_balance") {
        const configuredAccount = statementTable.getByRole("link", {
          name: "Monzo",
          exact: true,
        });
        await expect(configuredAccount).toBeVisible();
        await expect(
          configuredAccount.locator(".beancount-account-avatar"),
        ).toBeVisible();

        const hierarchyAccount = statementTable.getByRole("link", {
          name: "Assets",
          exact: true,
        });
        await expect(hierarchyAccount).toBeVisible();
        await expect(
          hierarchyAccount.locator(".beancount-account-avatar"),
        ).toHaveCount(0);
      }

      const numericCell = firstRow.locator(".font-mono").last();
      const numericFont = await numericCell.evaluate(
        (el) => getComputedStyle(el).fontFamily,
      );
      expect(numericFont.toLowerCase()).toContain("source code pro");

      await expect(
        statementTable.locator("[data-statement-weight-meter]").first(),
      ).toBeVisible();
      const [meterBox, weightBox] = await Promise.all([
        statementTable
          .locator("[data-statement-weight-meter]")
          .first()
          .boundingBox(),
        statementTable.locator("[data-statement-weight]").first().boundingBox(),
      ]);
      expect(meterBox).not.toBeNull();
      expect(weightBox).not.toBeNull();
      expect(meterBox!.x + meterBox!.width).toBeLessThanOrEqual(weightBox!.x);
      const weights = await statementTable
        .locator("[data-statement-weight]")
        .allTextContents();
      expect(weights.length).toBeGreaterThan(0);
      for (const weight of weights) {
        const percentage = Number.parseFloat(weight);
        if (!Number.isNaN(percentage))
          expect(percentage).toBeLessThanOrEqual(100);
      }
      await expect(
        page.locator("[data-statement-contribution-bar]").first(),
      ).toBeVisible();

      const expanderIcon = firstRow.locator("button svg").first();
      const iconSize = await expanderIcon.evaluate((el) => ({
        width: getComputedStyle(el).width,
        height: getComputedStyle(el).height,
      }));
      expect(parseFloat(iconSize.width)).toBe(12);
      expect(parseFloat(iconSize.height)).toBe(12);
    }

    await navigateTo(page, "Journal");
    await expect(page).toHaveURL(/\/ledger\/.+\/journal\/?/);
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

  test("scrolls financial-statement tables horizontally on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of [
      "/income_statement",
      "/balance_sheet",
      "/trial_balance",
    ]) {
      await gotoStudio(page, path);
      const table = page.locator("[data-statement-summary-tree-table]").first();
      await expect(table).toBeVisible({ timeout: 15_000 });

      const scrollState = await table.evaluate((element) => {
        const viewport = element.closest("[data-scroll-area-content]")
          ?.parentElement as HTMLElement | null;
        if (!viewport) {
          throw new Error("Financial statement table ScrollArea is missing");
        }
        viewport.scrollLeft = 160;
        const state = {
          clientWidth: viewport.clientWidth,
          scrollWidth: viewport.scrollWidth,
          scrollLeft: viewport.scrollLeft,
        };
        viewport.scrollLeft = 0;
        return state;
      });

      expect(scrollState.scrollWidth).toBeGreaterThan(scrollState.clientWidth);
      expect(scrollState.scrollLeft).toBeGreaterThan(0);
    }
  });

  test("styles Account Changes and Balances as interval tables", async ({
    page,
  }) => {
    await gotoStudio(page, "/account/Expenses");
    const changesTab = page.getByRole("tab", { name: "Changes (Monthly)" });
    await expect(changesTab).toBeVisible({ timeout: 15_000 });
    await changesTab.click();
    await expect(changesTab).toHaveAttribute("aria-selected", "true");

    const intervalTable = page.locator("[data-interval-tree-table]:visible");
    await expect(intervalTable).toHaveCount(1);
    await expect(intervalTable.locator(".flex-table")).toHaveCount(0);
    await expect(intervalTable.getByRole("table")).toBeVisible();
    await expect(
      intervalTable.getByRole("columnheader", { name: "Account" }),
    ).toBeVisible();
    await expect(
      intervalTable.getByRole("button", { name: "Collapse all accounts" }),
    ).toBeVisible();

    const surface = await intervalTable.evaluate((element) => {
      const header = element.querySelector("thead tr");
      if (!header) throw new Error("Interval table header is missing");
      return {
        borderRadius: getComputedStyle(element).borderTopLeftRadius,
        boxShadow: getComputedStyle(element).boxShadow,
        overflowX: getComputedStyle(element).overflowX,
        headerBackground: getComputedStyle(header).backgroundColor,
      };
    });
    expect(parseFloat(surface.borderRadius)).toBeGreaterThan(0);
    expect(surface.boxShadow).not.toBe("none");
    expect(surface.overflowX).toBe("auto");
    expect(surface.headerBackground).not.toBe("rgba(0, 0, 0, 0)");

    const branchToggle = intervalTable.locator("button[aria-expanded]").first();
    await expect(branchToggle).toHaveAttribute("aria-expanded", "true");
    await branchToggle.click();
    await expect(branchToggle).toHaveAttribute("aria-expanded", "false");

    const balancesTab = page.getByRole("tab", { name: "Balances (Monthly)" });
    await balancesTab.click();
    await expect(balancesTab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator("[data-interval-tree-table]:visible"),
    ).toHaveCount(1);
    await expect(
      page.locator("[data-interval-tree-table]:visible").getByRole("table"),
    ).toBeVisible();
  });

  test("loads codemirror theme styles", async ({ page }) => {
    await gotoStudio(page, "/editor");
    await waitForEditorContent(page, "Account Ledger");

    const editorFont = await page
      .locator(".beancount-editor .cm-content")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(editorFont.toLowerCase()).toMatch(/source code pro|mono|monospace/);
  });
});
