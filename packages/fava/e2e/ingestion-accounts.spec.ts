import { expect, test, type Page } from "@playwright/test";
import {
  gotoStudio,
  resolveProjectId,
  sampleLedger,
  seedLedger,
} from "./helpers";

async function resetIngestionConfig(page: Page) {
  const projectId = await resolveProjectId(page);
  const response = await page.request.put(
    `/api/projects/${encodeURIComponent(projectId)}/ingestion`,
    { data: { version: 1, sources: [] } },
  );
  expect(response.ok()).toBeTruthy();
}

async function seedMonzoSource(page: Page) {
  const projectId = await resolveProjectId(page);
  const response = await page.request.put(
    `/api/projects/${encodeURIComponent(projectId)}/ingestion`,
    {
      data: {
        version: 2,
        sources: [
          {
            id: "monzo",
            name: "Monzo Bank",
            kind: "monzo",
            config: {
              baseUrl: "https://api.monzo.com",
              allowedHosts: ["api.monzo.com"],
              secretRef: "env:MONZO_ACCESS_TOKEN",
              lookbackDays: 30,
            },
            rules: [],
            accounts: [],
          },
        ],
      },
    },
  );
  expect(response.ok()).toBeTruthy();
}

test.describe("ingestion account setup", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, sampleLedger);
    await resetIngestionConfig(page);
  });

  test.afterEach(async ({ page }) => {
    await resetIngestionConfig(page);
  });

  test("marks closed discovered accounts without preventing selection", async ({
    page,
  }) => {
    await seedMonzoSource(page);
    await page.route("**/ingestion/discover", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          accounts: [
            {
              id: "joint-account",
              name: "Joint · 04-00-04 · 32683320",
              currency: "GBP",
              institutionName: "Monzo Bank",
              closed: true,
            },
          ],
        }),
      });
    });

    await gotoStudio(page, "/import/accounts");
    await page.getByRole("button", { name: "Expand connection" }).click();
    await page.getByRole("button", { name: "Set Up New Accounts" }).click();

    const sheet = page.getByRole("dialog", { name: "Set Up New Accounts" });
    const accountName = "Joint · 04-00-04 · 32683320";
    const accountCheckbox = sheet.getByRole("checkbox", {
      name: `Select ${accountName}`,
    });
    await expect(sheet.getByText(accountName, { exact: true })).toBeVisible();
    await expect(sheet.getByText("Closed", { exact: true })).toHaveCount(1);
    await expect(accountCheckbox).toBeEnabled();

    await accountCheckbox.check();
    await expect(sheet.getByText("Closed", { exact: true })).toHaveCount(2);
  });
});
