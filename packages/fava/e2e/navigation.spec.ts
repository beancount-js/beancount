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
    await expect(page).toHaveURL(/#\/income_statement\?ledger=.+$/);
    await expect(
      page
        .locator("[data-ledger-file-panels] button")
        .filter({ hasText: "Income Statement" })
        .first(),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".tree-table-new").first()).toBeVisible();

    await navigateTo(page, "Balance Sheet");
    await expect(page).toHaveURL(/#\/balance_sheet\?ledger=.+$/);
    await expect(page.locator(".tree-table-new").first()).toBeVisible();

    await navigateTo(page, "Journal");
    await expect(page).toHaveURL(/#\/journal\?ledger=.+$/);

    await navigateTo(page, "Editor");
    await expect(page).toHaveURL(/#\/editor\?ledger=.+$/);
    await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
    await expect(
      page
        .locator("[data-ledger-file-panels] button")
        .filter({ hasText: "Editor" })
        .first(),
    ).toHaveAttribute("aria-current", "page");

    await page.reload();
    await page.waitForSelector("[data-ledger-file-row]");
    await expect(page).toHaveURL(/#\/editor\?ledger=.+$/);
    await expect(
      page
        .locator("[data-ledger-file-panels] button")
        .filter({ hasText: "Editor" })
        .first(),
    ).toHaveAttribute("aria-current", "page");
  });

  test("income statement renders without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openEditor(page);
    await waitForEditorContent(page, "Account Ledger");
    await navigateTo(page, "Income Statement");
    await expect(page).toHaveURL(/#\/income_statement\?ledger=.+$/);
    await expect(page.locator(".tree-table-new").first()).toBeVisible({
      timeout: 15_000,
    });

    expect(
      pageErrors.filter((message) => message.includes("reading 'copy'")),
    ).toHaveLength(0);
  });

  test("journal groups records and opens a transaction sheet", async ({
    page,
  }) => {
    await openEditor(page);
    await navigateTo(page, "Journal");
    await page.waitForSelector("[data-journal-table]");
    await expect(page.getByText("Start balance")).toBeVisible();

    const groupHeader = page
      .locator("[data-journal-table] section > div:first-child")
      .first();
    await expect(groupHeader).toHaveCSS("grid-template-columns", /.+ .+ .+ .+/);

    const [masterCheckboxX, groupCheckboxX, recordCheckboxX] =
      await Promise.all([
        page
          .getByLabel("Select visible journal records")
          .evaluate((element) => element.getBoundingClientRect().x),
        page
          .locator("[data-journal-table] input[aria-label^='Select all']")
          .first()
          .evaluate((element) => element.getBoundingClientRect().x),
        page
          .locator("[data-journal-table] [role=button] input[type=checkbox]")
          .first()
          .evaluate((element) => element.getBoundingClientRect().x),
      ]);
    expect([groupCheckboxX, recordCheckboxX]).toEqual([
      masterCheckboxX,
      masterCheckboxX,
    ]);

    await groupHeader.locator("[data-journal-group-toggle]").click();
    await expect(page.getByText("Start balance")).not.toBeVisible();
    await groupHeader.locator("[data-journal-group-toggle]").click();
    await expect(page.getByText("Start balance")).toBeVisible();

    const records = page.locator(
      "[data-journal-table] [role=button][aria-label^='Edit ']",
    );
    expect(await records.count()).toBeGreaterThan(0);
    await records.first().click();
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#\/journal\?ledger=.+&record=.+$/);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).not.toBeVisible();
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
    await page.waitForSelector("[data-ledger-file-row]");
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
