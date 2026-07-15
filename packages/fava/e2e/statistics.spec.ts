import { expect, test } from "@playwright/test";

import { sampleLedger, seedLedger } from "./helpers";

test("Statistics shows one full-height table at a time", async ({ page }) => {
  await seedLedger(page, sampleLedger);
  await page.goto("/#/statistics");

  await expect(
    page.getByRole("tab", { name: "Postings per Account", exact: true }),
  ).toHaveAttribute("data-state", "active");
  await expect(page.locator("[data-query-table]")).toHaveCount(1);

  const layout = await page
    .locator("[data-query-table]")
    .evaluate((element) => {
      const virtualList = element.querySelector(".virtual-list-wrapper");
      const container = element.closest("[data-content-scroll-area]");
      if (!virtualList || !container) {
        throw new Error("Missing Statistics table");
      }

      const tableRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        bottomGap: containerRect.bottom - tableRect.bottom,
        height: virtualList.clientHeight,
        overflowY: getComputedStyle(virtualList).overflowY,
        scrollHeight: virtualList.scrollHeight,
        viewportHeight: window.innerHeight,
      };
    });

  expect(layout.height).toBeGreaterThanOrEqual(layout.viewportHeight - 220);
  expect(layout.scrollHeight).toBe(layout.height);
  expect(layout.overflowY).toBe("visible");
  expect(layout.bottomGap).toBeLessThanOrEqual(24);

  await page
    .getByRole("tab", { name: "Entries Per Type", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Entries Per Type", exact: true }),
  ).toHaveAttribute("data-state", "active");
  await expect(page.locator("[data-query-table]")).toHaveCount(1);
  await expect(page.locator("[data-query-table]")).toContainText("type");
});

test("Query results use the page container for vertical scrolling", async ({
  page,
}) => {
  await seedLedger(page, sampleLedger);
  await page.goto("/#/query?qs=SELECT%20account%20FROM%20postings");

  const table = page.locator("[data-query-table]");
  await expect(table).toBeVisible();

  const layout = await table.evaluate((element) => {
    const virtualList = element.querySelector(".virtual-list-wrapper");
    if (!virtualList) throw new Error("Missing query result table");

    return {
      height: virtualList.clientHeight,
      overflowY: getComputedStyle(virtualList).overflowY,
      scrollHeight: virtualList.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });

  expect(layout.height).toBeGreaterThanOrEqual(layout.viewportHeight - 220);
  expect(layout.scrollHeight).toBe(layout.height);
  expect(layout.overflowY).toBe("visible");
});
