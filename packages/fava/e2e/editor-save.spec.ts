import { expect, test } from "@playwright/test";
import {
  clearLedger,
  minimalLedger,
  openEditor,
  readProjectLedger,
  replaceEditorContent,
  restoreSampleLedger,
  saveLedgerWithButton,
  seedLedger,
  waitForEditorContent,
} from "./helpers";

const freshLedger = `option "title" "E2E Button Save Ledger"
option "operating_currency" "USD"

2024-01-01 open Assets:Checking USD
2024-01-01 open Equity:Opening-Balances

2024-06-15 * "E2E Save Button" "Saved via UI button"
  Expenses:Food   12.00 USD
  Assets:Checking -12.00 USD
`;

test.describe("editor save", () => {
  test.afterEach(async ({ page }) => {
    await restoreSampleLedger(page);
  });

  test("save button persists replaced content across reload", async ({
    page,
  }) => {
    await seedLedger(page, minimalLedger);
    await openEditor(page);
    await waitForEditorContent(page, "Coffee Shop");

    await replaceEditorContent(page, freshLedger);
    await expect(
      page.locator(".beancount-editor .cm-content"),
    ).not.toContainText("Coffee Shop");
    await expect(page.locator(".beancount-editor .cm-content")).toContainText(
      "E2E Save Button",
    );

    await saveLedgerWithButton(page, "E2E Save Button");

    const stored = await readProjectLedger(page);
    expect(stored).toContain("E2E Save Button");
    expect(stored).toContain("E2E Button Save Ledger");
    expect(stored).not.toContain("Coffee Shop");

    await page.reload();
    await waitForEditorContent(page, "E2E Save Button");
    await expect(page.locator(".beancount-editor .cm-content")).toContainText(
      "E2E Button Save Ledger",
    );
    await expect(
      page.locator(".beancount-editor .cm-content"),
    ).not.toContainText("Coffee Shop");
  });

  test("save button persists after clearing editor and entering new ledger", async ({
    page,
  }) => {
    await clearLedger(page);
    await openEditor(page);
    await page.waitForSelector(".beancount-editor .cm-content");

    await replaceEditorContent(page, freshLedger);
    await saveLedgerWithButton(page, "E2E Save Button");

    const stored = await readProjectLedger(page);
    expect(stored).toContain("E2E Save Button");

    await page.reload();
    await waitForEditorContent(page, "E2E Save Button");
  });
});
