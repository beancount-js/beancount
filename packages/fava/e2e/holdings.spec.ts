import { expect, test } from "@playwright/test";

import { sampleLedger, seedLedger } from "./helpers";

test("Holdings uses the page container for vertical scrolling", async ({
  page,
}) => {
  await seedLedger(page, sampleLedger);
  await page.goto("/#/holdings");

  const table = page.locator("[data-query-table]");
  await expect(table).toBeVisible();

  const layout = await table.evaluate((element) => {
    const virtualList = element.querySelector(".virtual-list-wrapper");
    const container = element.closest("[data-content-scroll-area]");
    if (!virtualList || !container) throw new Error("Missing Holdings table");

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
});
