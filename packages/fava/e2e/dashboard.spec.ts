import { expect, test } from "@playwright/test";

import { gotoStudio, sampleLedger, seedLedger } from "./helpers";

test.describe("financial dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, sampleLedger);
    await gotoStudio(page, "/dashboard");
    await expect(page.locator("[data-dashboard-flow]")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("highlights and describes cash-flow streams", async ({ page }) => {
    const streams = page.locator("[data-dashboard-flow-stream]");
    expect(await streams.count()).toBeGreaterThan(2);

    const targetLabelGaps = await page
      .locator("[data-dashboard-flow]")
      .evaluate((svg) => {
        const rows = Array.from(svg.querySelectorAll("a.flow-node"))
          .filter(
            (node) =>
              Number(node.querySelector("rect")?.getAttribute("x")) > 500,
          )
          .map((node) => {
            const [label, amount] = node.querySelectorAll("text");
            return {
              labelTop: label.getBoundingClientRect().top,
              amountBottom: amount.getBoundingClientRect().bottom,
            };
          });
        return rows
          .slice(0, -1)
          .map((row, index) => rows[index + 1].labelTop - row.amountBottom);
      });
    expect(Math.min(...targetLabelGaps)).toBeGreaterThanOrEqual(0);

    const activeStream = page.locator(
      '[data-dashboard-flow-stream][data-side="out"][data-account="Expenses:Joint"]',
    );
    const otherStream = page.locator(
      '[data-dashboard-flow-stream][data-side="out"][data-account="Expenses:Taxes:PAYE"]',
    );
    await expect(activeStream).toBeVisible();
    await activeStream.hover();

    const tooltip = page.locator("[data-dashboard-chart-tooltip]");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Cash flow → Joint");
    await expect(tooltip).toContainText("%");
    const [activeOpacity, otherOpacity] = await Promise.all([
      activeStream.evaluate((element) => getComputedStyle(element).opacity),
      otherStream.evaluate((element) => getComputedStyle(element).opacity),
    ]);
    expect(Number(activeOpacity)).toBeGreaterThan(Number(otherOpacity));

    await activeStream.focus();
    await expect(tooltip).toContainText("Cash flow → Joint");
    await activeStream.press("Escape");
    await expect(tooltip).not.toBeVisible();

    const accountLink = page.locator(
      '[data-dashboard-flow] a[href*="/account/Expenses"][href*="Interest"]',
    );
    await accountLink.click();
    await expect(page).toHaveURL(
      /\/ledger\/.+\/account\/Expenses(?::|%3A)Interest\/?/,
    );
  });

  test("renders aligned, collapsible balance trees", async ({ page }) => {
    const tables = page.locator("[data-dashboard-tree-table]");
    await expect(tables).toHaveCount(3);
    const assetsTable = tables.first();
    await expect(assetsTable).toBeVisible();

    const columns = await assetsTable.evaluate((element) => {
      const header = element.querySelector(
        "[data-dashboard-tree-rows] > li:first-child",
      );
      const row = element.querySelector("[data-dashboard-tree-row]");
      if (!header || !row) throw new Error("Missing dashboard tree rows");
      return {
        header: getComputedStyle(header).gridTemplateColumns,
        row: getComputedStyle(row).gridTemplateColumns,
      };
    });
    expect(columns.header).toBe(columns.row);

    const firstMeter = assetsTable
      .locator("[data-dashboard-weight-meter]")
      .first();
    await expect(firstMeter).toBeVisible();
    await expect(firstMeter.locator(":scope > span")).toHaveCount(5);
    await expect(firstMeter).toHaveCSS("display", "grid");

    const firstRow = assetsTable.locator("[data-dashboard-tree-row]").first();
    await expect(firstRow).toHaveClass(/hover:bg-muted/);

    await assetsTable
      .getByRole("button", { name: "Collapse all accounts", exact: true })
      .click();
    await expect(
      assetsTable.getByRole("link", { name: "Checking", exact: true }),
    ).not.toBeVisible();
    await assetsTable
      .getByRole("button", { name: "Expand all accounts", exact: true })
      .click();
    await expect(
      assetsTable.getByRole("link", { name: "Checking", exact: true }),
    ).toBeVisible();

    const assetsToggle = assetsTable.getByRole("button", {
      name: "Collapse Assets",
      exact: true,
    });
    await assetsToggle.click();
    await expect(
      assetsTable.getByRole("link", { name: "Checking", exact: true }),
    ).not.toBeVisible();
    await assetsTable
      .getByRole("button", { name: "Expand Assets", exact: true })
      .click();
    await expect(
      assetsTable.getByRole("link", { name: "Checking", exact: true }),
    ).toBeVisible();
  });

  test("scrolls dashboard tables horizontally on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const table of [
      page.locator("[data-dashboard-outflow-table]"),
      page.locator("[data-dashboard-tree-rows]").first(),
    ]) {
      await expect(table).toBeVisible();
      const scrollState = await table.evaluate((element) => {
        const viewport = element.closest("[data-scroll-area-content]")
          ?.parentElement as HTMLElement | null;
        if (!viewport) throw new Error("Dashboard table ScrollArea is missing");
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

  test("shows a themed interactive net-worth trend", async ({ page }) => {
    const chart = page.locator("[data-dashboard-net-worth-chart]");
    await expect(chart).toBeVisible();
    await expect(chart.locator("[data-dashboard-date-label]")).toHaveCount(2);
    await expect(chart).toHaveClass(/positive|negative|neutral/);

    await chart.focus();
    await chart.press("Home");
    await expect(chart).toHaveAttribute("aria-valuenow", "0");
    await chart.press("ArrowRight");
    await expect(chart).toHaveAttribute("aria-valuenow", "1");
    const crosshair = page.locator("[data-dashboard-crosshair]");
    await expect(crosshair).toHaveCount(1);
    await expect(crosshair).toHaveAttribute("x1", /\d/);
    await expect(page.locator("[data-dashboard-active-point]")).toBeVisible();
    await expect(page.locator("[data-dashboard-chart-tooltip]")).toContainText(
      "%",
    );

    await chart.press("Escape");
    const line = chart.locator("[data-dashboard-line-base]");
    const lightStroke = await line.evaluate(
      (element) => getComputedStyle(element).stroke,
    );
    await page.getByRole("button", { name: "Toggle theme" }).click();
    const darkStroke = await line.evaluate(
      (element) => getComputedStyle(element).stroke,
    );
    expect(lightStroke).not.toBe(darkStroke);
  });
});
