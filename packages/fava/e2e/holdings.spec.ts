import { expect, test } from "@playwright/test";

import { gotoStudio, sampleLedger, seedLedger } from "./helpers";

test("Holdings renders a sortable, paginated table", async ({ page }) => {
  await seedLedger(page, sampleLedger);
  await gotoStudio(page, "/holdings");

  const table = page.locator("[data-query-table]");
  await expect(table).toBeVisible();

  const accountSort = table.getByRole("button", { name: "Sort by account" });
  const accountHeader = table.getByRole("columnheader", {
    name: "Sort by account",
  });
  await expect(accountSort).toBeVisible();
  await expect(accountHeader).toHaveAttribute("aria-sort", "none");
  await accountSort.click();
  await expect(accountHeader).toHaveAttribute("aria-sort", "ascending");
  await accountSort.click();
  await expect(accountHeader).toHaveAttribute("aria-sort", "descending");

  await expect(table.locator("table")).toBeVisible();
  await expect(table.locator(".virtual-list-wrapper")).toHaveCount(0);

  const pagination = table.locator("[data-query-pagination]");
  await expect(
    pagination.getByText(/^Showing 1\u2013\d+ of \d+$/),
  ).toBeVisible();
  await expect(table.locator("[data-query-page-size]")).toHaveText("25");
});
