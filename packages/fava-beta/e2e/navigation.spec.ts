import { expect, test } from "@playwright/test";
import {
  gotoStudio,
  navigateTo,
  openEditor,
  restoreSampleLedger,
  seedLedger,
  sampleLedger,
  waitForEditorContent,
} from "./helpers";

test.describe("sample ledger navigation", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, sampleLedger);
  });

  test.afterEach(async ({ page }) => {
    await restoreSampleLedger(page);
  });

  test("sidebar navigation updates the path route", async ({ page }) => {
    await openEditor(page);
    await waitForEditorContent(page, "Account Ledger");

    await navigateTo(page, "Income Statement");
    await expect(page).toHaveURL(/\/ledger\/.+\/income-statement\/?/);
    await expect(
      page
        .locator("[data-ledger-file-panels] button")
        .filter({ hasText: "Income Statement" })
        .first(),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.locator("[data-statement-summary-tree-table]").first(),
    ).toBeVisible();
    await expect(page.locator("[data-statement-report]")).toContainText(
      "Net Profit",
    );
    await expect(
      page.locator("[data-statement-report] [data-statement-summary]"),
    ).toHaveCount(3);

    await navigateTo(page, "Balance Sheet");
    await expect(page).toHaveURL(/\/ledger\/.+\/balance-sheet\/?/);
    await expect(
      page.locator("[data-statement-summary-tree-table]").first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-statement-report] [data-statement-summary]"),
    ).toHaveCount(3);

    await navigateTo(page, "Journal");
    await expect(page).toHaveURL(/\/ledger\/.+\/journal\/?/);

    await navigateTo(page, "Editor");
    await expect(page).toHaveURL(/\/ledger\/.+\/editor\/?/);
    await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
    await expect(
      page
        .locator("[data-ledger-file-panels] button")
        .filter({ hasText: "Editor" })
        .first(),
    ).toHaveAttribute("aria-current", "page");

    await page.reload();
    await page.waitForSelector("[data-ledger-file-row]");
    await expect(page).toHaveURL(/\/ledger\/.+\/editor\/?/);
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
    await expect(
      settingsSidebar.getByRole("button", { name: /Review imports/ }),
    ).toBeVisible();
    await expect(
      settingsSidebar.getByRole("button", { name: /Review merchants/ }),
    ).toBeVisible();
    await expect(
      settingsSidebar.getByRole("button", { name: /Accounts/ }),
    ).toBeVisible();
    await expect(page.locator("[data-ledger-file-panels]")).toHaveCount(0);

    await settingsSidebar.getByRole("button", { name: /Import/ }).click();
    await expect(page).toHaveURL(/\/ledger\/.+\/settings\/?/);
    await expect(
      settingsSidebar.getByRole("button", { name: /Import/ }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      settingsSidebar.getByRole("button", { name: /Review imports/ }),
    ).not.toHaveAttribute("aria-current", "page");
    await expect(
      settingsSidebar.getByRole("button", { name: /Accounts/ }),
    ).not.toHaveAttribute("aria-current", "page");

    await settingsSidebar
      .getByRole("button", { name: /Review imports/ })
      .click();
    await expect(page).toHaveURL(/\/ledger\/.+\/records\/?/);
    await expect(page.locator("[data-ingestion-review]")).toBeVisible();
    await expect(
      settingsSidebar.getByRole("button", { name: /Review imports/ }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      settingsSidebar.getByRole("button", { name: /Import/ }),
    ).not.toHaveAttribute("aria-current", "page");

    await settingsSidebar.getByRole("button", { name: /Accounts/ }).click();
    await expect(page).toHaveURL(/\/ledger\/.+\/settings\/accounts\/?/);
    await expect(page.locator("[data-ingestion-accounts-setup]")).toBeVisible();
    await expect(
      settingsSidebar.getByRole("button", { name: /Accounts/ }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      settingsSidebar.getByRole("button", { name: /Import/ }),
    ).not.toHaveAttribute("aria-current", "page");
    await expect(
      settingsSidebar.getByRole("button", { name: /Review imports/ }),
    ).not.toHaveAttribute("aria-current", "page");
    // Empty or connected: page should not offer review-import Fetch as primary CTA.
    await expect(
      page.getByRole("button", { name: "Fetch transactions" }),
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: "Back to ledger navigation" })
      .click();
    await expect(page.locator("[data-ledger-settings-sidebar]")).toHaveCount(0);
    await expect(page).toHaveURL(/\/ledger\/.+\/editor\/?/);
    await expect(
      page.locator("[data-ledger-file-panels]").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import", exact: true }),
    ).toHaveCount(0);
  });

  test("review imports uses Force re-fetch instead of primary Fetch", async ({
    page,
  }) => {
    await gotoStudio(page, "/records?ledger=sample.beancount");
    await expect(page.locator("[data-ingestion-review]")).toBeVisible({
      timeout: 15_000,
    });
    const header = page.locator("[data-slot='studio-workspace-header']");
    await expect(header.getByText("Review imports")).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Select source" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Force re-fetch" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Open Accounts" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Edit sources" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", {
        name: /Expand all date groups|Collapse all date groups/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fetch transactions" }),
    ).toHaveCount(0);
  });

  test("review merchants opens from settings sidebar", async ({ page }) => {
    await gotoStudio(page, "/import/merchants?ledger=sample.beancount");
    await expect(page).toHaveURL(/\/ledger\/.+\/settings\/merchants\/?/);
    await expect(page.locator("[data-ingestion-merchant-review]")).toBeVisible({
      timeout: 15_000,
    });
    const header = page.locator("[data-slot='studio-workspace-header']");
    await expect(header.getByText("Review merchants")).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Select source" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Detect merchants" }),
    ).toBeVisible();
    const settingsSidebar = page.locator("[data-ledger-settings-sidebar]");
    await expect(
      settingsSidebar.getByRole("button", { name: /Review merchants/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("loads report data for the ledger selected in the URL", async ({
    page,
  }) => {
    await gotoStudio(page, "/journal?ledger=sample-budgets.beancount");
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
    await expect(page).toHaveURL(/\/ledger\/.+\/income-statement\/?/);
    await expect(
      page.locator("[data-statement-summary-tree-table]").first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("svg .tick text").first()).toHaveCSS(
      "font-family",
      /Source Code Pro/,
    );

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
      page.getByRole("heading", { name: "Edit Transaction" }),
    ).toBeVisible();
    await expect(page.getByRole("switch", { name: "YAML mode" })).toBeVisible();
    await expect(page).toHaveURL(/\/ledger\/.+\/journal\/\?.*record=/);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Transaction" }),
    ).not.toBeVisible();
    await accountLink.click();
    await expect(page).toHaveURL(/\/ledger\/.+\/account\//);
    await expect(
      page.getByRole("heading", { name: "Edit Transaction" }),
    ).not.toBeVisible();
  });
});

test.describe("account details", () => {
  test("root account page uses the canonical activity view", async ({
    page,
  }) => {
    await gotoStudio(page, "/accounts");
    await page.waitForSelector("[data-ledger-file-row]");
    await expect(page).toHaveURL(/\/ledger\/.+\/accounts\/?/);
    await expect(page.getByRole("tab", { name: "Account Table" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-account-activity-table]")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByLabel("Select visible account activity records"),
    ).toBeVisible();
  });

  test("account page renders without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await gotoStudio(page, "/account/Assets:Checking");
    await page.waitForSelector("[data-ledger-file-row]");
    await expect(page).toHaveURL(
      /\/ledger\/.+\/account\/Assets(?::|%3A)Checking\/?/,
    );
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
      page.getByRole("heading", { name: "Edit Transaction" }),
    ).toBeVisible();
    await expect(page.getByRole("switch", { name: "YAML mode" })).toBeVisible();
    await expect(page).toHaveURL(
      /\/ledger\/.+\/account\/Assets(?::|%3A)Checking\/\?.*record=/,
    );
    await page.getByRole("button", { name: "Close" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Transaction" }),
    ).not.toBeVisible();
    await expect(page).toHaveURL(
      /\/ledger\/.+\/account\/Assets(?::|%3A)Checking\/?/,
    );

    const otherAccountLink = page
      .locator("[data-account-posting] a")
      .filter({ hasNotText: /^Assets:Checking$/ })
      .first();
    await expect(otherAccountLink).toBeVisible();
    await otherAccountLink.click();
    await expect(page).toHaveURL(/\/ledger\/.+\/account\//);
    await expect(page).not.toHaveURL(
      /\/ledger\/.+\/account\/Assets(?::|%3A)Checking\/?$/,
    );
    await expect(
      page.getByRole("heading", { name: "Edit Transaction" }),
    ).not.toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("account activity pagination", () => {
  test("keeps date groups intact while paginating account activity", async ({
    page,
  }) => {
    await gotoStudio(page, "/account/Assets:Checking:Starling?pageSize=5");
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
    await page.getByRole("button", { name: "Go to next page" }).click();
    await expect(page).toHaveURL(
      /\/ledger\/.+\/account\/Assets(?::|%3A)Checking(?::|%3A)Starling\/?\?.*pageSize=5.*page=2/,
    );
    await expect(firstDateGroup).not.toHaveText(firstDate);
  });
});
