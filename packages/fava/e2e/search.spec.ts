import { expect, test } from "@playwright/test";
import {
  gotoStudio,
  restoreSampleLedger,
  sampleLedger,
  seedLedger,
} from "./helpers";

test.describe("Faceted ledger search", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await seedLedger(page, sampleLedger);
    await gotoStudio(page, "/journal");
  });

  test.afterEach(async ({ page }) => {
    await restoreSampleLedger(page);
  });

  test("updates URL facets and opens the editor from a result", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Search" }).click();
    const searchTab = page.locator("[data-slot=search-tab]");

    await searchTab
      .getByRole("button", { name: "Expand filter options" })
      .click();
    await expect(
      searchTab.getByRole("button", { name: "Collapse filter options" }),
    ).toBeVisible();
    await expect(searchTab.getByRole("button", { name: "Type" })).toBeVisible();
    await expect(
      searchTab.getByRole("button", { name: "Account" }),
    ).toBeVisible();
    await expect(
      searchTab.getByRole("button", { name: "Sort search results" }),
    ).toBeVisible();

    const searchBox = searchTab.getByRole("searchbox", {
      name: "Search ledger",
    });
    await searchBox.click();
    await searchBox.fill("Assets");
    await expect.poll(() => page.url()).toMatch(/searchQ=Assets/);
    await expect(
      searchTab.getByRole("button", { name: "Clear search for Assets" }),
    ).toBeVisible();

    // Collapse filters so the results pane has room in the sidebar.
    await searchTab
      .getByRole("button", { name: "Collapse filter options" })
      .click();
    await expect(searchTab.getByText(/\d+\s+matches?/)).toBeVisible({
      timeout: 10_000,
    });

    const results = searchTab.locator('[aria-label="Search results"]');
    await expect(results).toBeVisible();
    const firstHit = results.locator("ul button").first();
    await expect(firstHit).toBeVisible();
    await firstHit.click();

    await expect.poll(() => page.url()).toMatch(/record=/);
    await expect(page.getByRole("heading", { name: /^Edit / })).toBeVisible();
    await expect(page.getByRole("switch", { name: "YAML mode" })).toBeVisible();
    await expect(page.locator("[data-journal-editor-sheet]")).toBeVisible();
  });
});
