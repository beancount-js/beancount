import { expect, test } from "@playwright/test";
import {
  minimalLedger,
  navigateTo,
  openEditor,
  seedLedger,
  sampleLedger,
  waitForEditorContent,
} from "./helpers";

test.describe("sample ledger navigation", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, sampleLedger);
  });

  test("sidebar navigation updates the hash route", async ({ page }) => {
    await openEditor(page);
    await waitForEditorContent(page, "Account Ledger");

    await navigateTo(page, "Income Statement");
    await expect(page).toHaveURL(/#\/income_statement$/);
    await expect(page.locator(".tree-table-new").first()).toBeVisible();

    await navigateTo(page, "Balance Sheet");
    await expect(page).toHaveURL(/#\/balance_sheet$/);
    await expect(page.locator(".tree-table-new").first()).toBeVisible();

    await navigateTo(page, "Journal");
    await expect(page).toHaveURL(/#\/journal$/);

    await navigateTo(page, "Editor");
    await expect(page).toHaveURL(/#\/editor$/);
    await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
  });

  test("income statement renders without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openEditor(page);
    await waitForEditorContent(page, "Account Ledger");
    await navigateTo(page, "Income Statement");
    await expect(page).toHaveURL(/#\/income_statement$/);
    await expect(page.locator(".tree-table-new").first()).toBeVisible({
      timeout: 15_000,
    });

    expect(
      pageErrors.filter((message) => message.includes("reading 'copy'")),
    ).toHaveLength(0);
  });
});

test.describe("account details", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, minimalLedger);
  });

  test("account page renders without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/#/account/Expenses");
    await page.waitForSelector("nav");
    await expect(page).toHaveURL(/#\/account\/Expenses$/);
    await expect(page.getByRole("tab", { name: "Account Table" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator(".payee").filter({ hasText: "Coffee Shop" }),
    ).toBeVisible({
      timeout: 15_000,
    });

    expect(pageErrors).toHaveLength(0);
  });
});
