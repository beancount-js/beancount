import { expect, test } from "@playwright/test";

import { gotoStudio, minimalLedger, sampleLedger, seedLedger } from "./helpers";

test("Holdings renders a sortable, paginated table", async ({ page }) => {
  await seedLedger(
    page,
    sampleLedger.replace(
      "2022-09-01 open     Assets:Cash                                GBP",
      '2022-09-01 open     Assets:Cash                                GBP\n  merchant_id: "merchant:cash"',
    ),
  );
  await gotoStudio(page, "/holdings");

  const table = page.locator("[data-query-table]");
  await expect(table).toBeVisible();

  const cashAccount = table.getByRole("link", {
    name: "Assets:Cash",
    exact: true,
  });
  await expect(cashAccount).toHaveAttribute(
    "data-merchant-id",
    "merchant:cash",
  );
  await expect(
    cashAccount.locator(".beancount-account-avatar"),
  ).toHaveAttribute("data-size", "sm");

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
  await expect(table.locator("[data-query-page-size]")).toHaveText("10");
});

test("Query tables use a compact search field and expandable saved queries", async ({
  page,
}) => {
  await seedLedger(page, minimalLedger);
  await gotoStudio(page, "/query?qs=SELECT%20account%20FROM%20postings");

  const table = page.locator("[data-query-table]");
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator("[data-query-pagination]")).toHaveCount(0);

  const queryEditor = page.locator("[data-query-editor]");
  await expect(queryEditor).toBeVisible();
  const executeButton = queryEditor.getByRole("button", {
    name: "Execute",
  });
  await expect(executeButton).toBeVisible();
  await expect(executeButton.locator("svg")).toHaveCount(1);
  await expect(executeButton).toHaveClass(/bg-secondary/);
  await expect(executeButton).toHaveClass(/hover:bg-secondary\/80/);
  await expect(queryEditor.locator(".cm-gutters")).toHaveCount(0);

  const savedQuery = page
    .locator("[data-query-history-item]")
    .filter({ hasText: "SELECT account FROM postings" });
  await expect(savedQuery).toBeVisible();
  await expect(savedQuery.locator("[data-query-history-header]")).toBeVisible();
  await expect(
    savedQuery.getByRole("button", { name: /^Copy query:/ }),
  ).toBeVisible();
  await expect(
    savedQuery.getByRole("button", { name: /^Delete query:/ }),
  ).toBeVisible();

  const trigger = savedQuery.locator("[data-query-history-trigger]");
  const [triggerBounds, indicatorBounds] = await Promise.all([
    trigger.boundingBox(),
    trigger.locator("svg").boundingBox(),
  ]);
  expect(triggerBounds).not.toBeNull();
  expect(indicatorBounds).not.toBeNull();
  expect(indicatorBounds!.x).toBeLessThanOrEqual(triggerBounds!.x + 1);
  await expect(trigger).toHaveClass(/gap-3/);

  const initialState = await trigger.getAttribute("data-state");
  await trigger.click();
  await expect(trigger).toHaveAttribute(
    "data-state",
    initialState === "open" ? "closed" : "open",
  );

  const [headerBounds, actionBounds] = await Promise.all([
    savedQuery.locator("[data-query-history-header]").boundingBox(),
    savedQuery.locator("[data-query-history-actions]").boundingBox(),
  ]);
  expect(headerBounds).not.toBeNull();
  expect(actionBounds).not.toBeNull();
  expect(actionBounds!.x + actionBounds!.width).toBeGreaterThanOrEqual(
    headerBounds!.x + headerBounds!.width - 16,
  );
});

test("Query errors render in the results table footer", async ({ page }) => {
  await seedLedger(page, minimalLedger);
  await gotoStudio(page, "/query?qs=SELECT%20units%20FROM%20postings");

  const table = page.locator("[data-query-table]");
  const errorFooter = table.locator("[data-query-error-footer]");
  await expect(errorFooter).toBeVisible();
  await expect(errorFooter).toHaveClass(/bg-destructive\/10/);
  await expect(errorFooter.getByRole("alert")).toContainText(
    'column "units" not found in table "postings"',
  );
  await expect(table.locator("tbody")).toContainText("No results.");

  const [bodyBounds, errorBounds] = await Promise.all([
    table.locator("tbody").boundingBox(),
    errorFooter.boundingBox(),
  ]);
  expect(bodyBounds).not.toBeNull();
  expect(errorBounds).not.toBeNull();
  expect(errorBounds!.y).toBeGreaterThan(bodyBounds!.y);
});
