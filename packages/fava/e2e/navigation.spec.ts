import { expect, test } from "@playwright/test";
import {
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
    await expect(
      page.locator("[data-statement-summary-tree-table]").first(),
    ).toBeVisible();

    await navigateTo(page, "Balance Sheet");
    await expect(page).toHaveURL(/#\/balance_sheet\?ledger=.+$/);
    await expect(
      page.locator("[data-statement-summary-tree-table]").first(),
    ).toBeVisible();

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

  test("moves Import into the selected ledger settings sidebar", async ({
    page,
  }) => {
    await openEditor(page);
    await waitForEditorContent(page, "Account Ledger");

    const settingsButton = page.getByRole("button", {
      name: "Ledger settings",
    });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    const settingsSidebar = page.locator("[data-ledger-settings-sidebar]");
    await expect(settingsSidebar).toBeVisible();
    await expect(
      settingsSidebar.getByRole("button", { name: /Import/ }),
    ).toBeVisible();
    await expect(page.locator("[data-ledger-file-panels]")).toHaveCount(0);

    await settingsSidebar.getByRole("button", { name: /Import/ }).click();
    await expect(page).toHaveURL(/#\/records\?ledger=.+$/);

    await page
      .getByRole("button", { name: "Back to ledger navigation" })
      .click();
    await expect(page.locator("[data-ledger-settings-sidebar]")).toHaveCount(0);
    await expect(
      page.locator("[data-ledger-file-panels]").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import", exact: true }),
    ).toHaveCount(0);
  });

  test("loads report data for the ledger selected in the URL", async ({
    page,
  }) => {
    await page.goto("/#/journal?ledger=sample-budgets.beancount");
    await page.waitForSelector("[data-journal-table]");

    await expect(
      page.getByText("China Garden", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-ledger-file-row="sample-budgets.beancount"]'),
    ).toBeVisible();
  });

  test("income statement renders without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openEditor(page);
    await waitForEditorContent(page, "Account Ledger");
    await navigateTo(page, "Income Statement");
    await expect(page).toHaveURL(/#\/income_statement\?ledger=.+$/);
    await expect(
      page.locator("[data-statement-summary-tree-table]").first(),
    ).toBeVisible({ timeout: 15_000 });

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
    await expect(records.first().locator("[data-journal-posting]")).toHaveCount(
      2,
    );
    const postingColumns = await page
      .locator("[data-journal-posting]")
      .evaluateAll((elements) =>
        elements.map(
          (element) => getComputedStyle(element).gridTemplateColumns,
        ),
      );
    expect([...new Set(postingColumns)]).toHaveLength(1);
    expect(postingColumns[0]).toMatch(/128px$/);
    const accountTextAlignments = await page
      .locator("[data-journal-posting] > a:first-child")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).textAlign),
      );
    expect([...new Set(accountTextAlignments)]).toEqual(["left"]);
    const accountLink = page.locator("[data-journal-posting] a").first();
    await expect(accountLink).toHaveText(/^(Assets|Liabilities):/);
    await records.first().click();
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#\/journal\?ledger=.+&record=.+$/);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).not.toBeVisible();
    await accountLink.click();
    await expect(page).toHaveURL(/#\/account\/.+$/);
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).not.toBeVisible();
  });
});

test.describe("account details", () => {
  test("account page renders without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/#/account/Assets:Checking");
    await page.waitForSelector("[data-ledger-file-row]");
    await expect(page).toHaveURL(/#\/account\/Assets:Checking\??$/);
    await expect(page.getByRole("tab", { name: "Account Table" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-account-activity-table]")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Balance", { exact: true })).toBeVisible();
    const activityRecords = page.locator(
      "[data-account-activity-table] [role=button][aria-label^='Edit ']",
    );
    await expect(activityRecords.first()).toBeVisible();
    await expect(
      page.getByText("Final balance", { exact: true }),
    ).toBeVisible();

    const [masterCheckboxX, groupCheckboxX, recordCheckboxX] =
      await Promise.all([
        page
          .getByLabel("Select visible account activity records")
          .evaluate((element) => element.getBoundingClientRect().x),
        page
          .locator(
            "[data-account-activity-table] input[aria-label^='Select all']",
          )
          .first()
          .evaluate((element) => element.getBoundingClientRect().x),
        page
          .locator(
            "[data-account-activity-table] [role=button] input[type=checkbox]",
          )
          .first()
          .evaluate((element) => element.getBoundingClientRect().x),
      ]);
    expect([groupCheckboxX, recordCheckboxX]).toEqual([
      masterCheckboxX,
      masterCheckboxX,
    ]);
    const firstGroupCheckbox = page
      .locator("[data-account-activity-table] input[aria-label^='Select all']")
      .first();
    const firstRecordCheckbox = page
      .locator(
        "[data-account-activity-table] [role=button] input[type=checkbox]",
      )
      .first();
    await firstGroupCheckbox.check();
    await expect(firstRecordCheckbox).toBeChecked();

    const groupToggle = page.locator("[data-activity-group-toggle]").first();
    await groupToggle.click();
    await expect(
      page.getByText("Start balance", { exact: true }),
    ).not.toBeVisible();
    await groupToggle.click();
    await expect(
      page.getByText("Start balance", { exact: true }),
    ).toBeVisible();

    const postingColumns = await page
      .locator("[data-account-posting]")
      .evaluateAll((elements) =>
        elements.map(
          (element) => getComputedStyle(element).gridTemplateColumns,
        ),
      );
    expect([...new Set(postingColumns)]).toHaveLength(1);
    expect(postingColumns[0]).toMatch(/128px$/);
    await expect(
      page.locator("[data-account-posting]").first().getByRole("link"),
    ).toHaveText(/^Assets:Checking/);

    await activityRecords.first().click();
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#\/account\/Assets:Checking\?record=.+$/);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).not.toBeVisible();
    await expect(page).toHaveURL(/#\/account\/Assets:Checking\??$/);

    const accountLink = page.locator("[data-account-posting] a").first();
    const previousUrl = page.url();
    await accountLink.click();
    await expect.poll(() => page.url()).not.toBe(previousUrl);
    await expect(
      page.getByRole("heading", { name: "Edit transaction" }),
    ).not.toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("account activity pagination", () => {
  test("keeps date groups intact while paginating account activity", async ({
    page,
  }) => {
    await page.goto("/#/account/Assets:Checking?pageSize=25");
    await expect(page.locator("[data-account-activity-table]")).toBeVisible({
      timeout: 15_000,
    });
    const firstDateGroup = page
      .locator("[data-account-activity-table] [role=heading]")
      .first();
    const firstDate = await firstDateGroup.innerText();
    await expect(
      page.getByRole("navigation", { name: "Account activity pages" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Next Account activity page" })
      .click();
    await expect(page).toHaveURL(
      /#\/account\/Assets:Checking\?pageSize=25&page=2$/,
    );
    await expect(firstDateGroup).not.toHaveText(firstDate);
  });
});
