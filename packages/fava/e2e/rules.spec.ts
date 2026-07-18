import { expect, test, type Page } from "@playwright/test";
import {
  gotoStudio,
  readProjectLedger,
  resolveProjectId,
  restoreSampleLedger,
  seedLedger,
} from "./helpers";

const ledger = `2026-01-01 open Assets:Bank:Current
2026-01-01 open Expenses:Uncategorized
2026-01-01 open Expenses:Food

2026-07-01 * "Coffee Shop" "Coffee Shop"
  Assets:Bank:Current  -4.50 GBP
  Expenses:Uncategorized  4.50 GBP
`;

const coffeeRule = {
  id: "e2e-coffee-rule",
  name: "Categorise coffee",
  resourceType: "transaction",
  active: true,
  effectiveDate: null,
  conditions: [
    {
      id: "coffee-condition",
      conditionType: "transaction_name",
      operator: "like",
      value: "Coffee Shop",
    },
  ],
  actions: [
    {
      id: "coffee-category",
      actionType: "set_transaction_category",
      value: "Expenses:Food",
    },
  ],
};

async function rulesUrl(page: Page) {
  const projectId = await resolveProjectId(page);
  return `/api/projects/${encodeURIComponent(projectId)}/rules`;
}

test.describe("rule runs", () => {
  let originalRules: unknown;

  test.beforeEach(async ({ page }) => {
    const url = await rulesUrl(page);
    const response = await page.request.get(url);
    expect(response.ok()).toBeTruthy();
    originalRules = await response.json();
    await seedLedger(page, ledger);
    const write = await page.request.put(url, {
      data: { version: 1, rules: [coffeeRule] },
    });
    expect(write.ok()).toBeTruthy();
  });

  test.afterEach(async ({ page }) => {
    await restoreSampleLedger(page);
    if (!originalRules) return;
    const write = await page.request.put(await rulesUrl(page), {
      data: originalRules,
    });
    expect(write.ok()).toBeTruthy();
  });

  test("defaults a bulk run to the live ledger and shows deduplicated preview counts", async ({
    page,
  }) => {
    await gotoStudio(page, "/settings/rules");
    await expect(page.locator("[data-rules-settings]")).toBeVisible();

    await page.getByRole("button", { name: "Apply all" }).click();
    const dialog = page.getByRole("dialog", { name: "Run rules" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: "Live ledger", exact: true }),
    ).toBeChecked();
    await expect(dialog).toContainText("1 unique matching entry");
    await expect(dialog).toContainText("1 live ledger entry");

    await dialog.getByRole("button", { name: "Run on live ledger" }).click();
    await expect
      .poll(() => readProjectLedger(page))
      .toContain("Expenses:Food 4.50 GBP");
    await expect(page.locator("[data-rules-settings]")).toContainText(
      "live ledger",
    );
  });
});
