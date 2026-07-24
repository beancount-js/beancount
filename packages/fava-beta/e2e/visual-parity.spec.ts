import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { gotoStudio, sampleLedger, seedLedger } from "./helpers";

const referenceDirectory = resolve(
  "../ui/tests/visual/storybook.spec.ts-snapshots/fava-reference/screens",
);
const maxDiffPixelRatio = 0.001;
const referenceDeviceScaleFactor = 3;

type ReferenceRoute = {
  id: string;
  viewPath: string;
  clickButton?: string;
  readySearchbox?: string;
};

const contentScrollAreaReferenceRoutes = [
  { id: "account-detail", viewPath: "/account/Assets:Checking" },
  { id: "dashboard", viewPath: "/dashboard" },
  { id: "query", viewPath: "/query" },
  { id: "income-statement", viewPath: "/income_statement" },
  { id: "balance-sheet", viewPath: "/balance_sheet" },
  { id: "trial-balance", viewPath: "/trial_balance" },
] as const;

const appShellReferenceRoutes: readonly ReferenceRoute[] = [
  { id: "account-detail", viewPath: "/account/Assets:Checking" },
  { id: "balance-sheet", viewPath: "/balance_sheet" },
  { id: "dashboard", viewPath: "/dashboard" },
  { id: "editor", viewPath: "/editor" },
  { id: "errors", viewPath: "/errors" },
  { id: "holdings", viewPath: "/holdings" },
  { id: "income-statement", viewPath: "/income_statement" },
  { id: "journal", viewPath: "/journal" },
  { id: "query", viewPath: "/query" },
  { id: "records", viewPath: "/records" },
  { id: "settings", viewPath: "/import/editor" },
  { id: "settings-accounts", viewPath: "/import/accounts" },
  { id: "settings-rules", viewPath: "/settings/rules" },
  { id: "statistics", viewPath: "/statistics" },
  { id: "trial-balance", viewPath: "/trial_balance" },
];

const searchFilterBarReferenceRoutes: readonly ReferenceRoute[] = [
  {
    id: "search-sidebar",
    viewPath: "/journal",
    clickButton: "Show search sidebar",
    readySearchbox: "Search ledger",
  },
];

test.use({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 3,
  locale: "en-GB",
  timezoneId: "Europe/London",
  colorScheme: "light",
  reducedMotion: "reduce",
});

test.describe("frozen Fava visual parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, sampleLedger);
  });

  async function expectFrozenSurfaceParity(
    page: Page,
    reference: ReferenceRoute,
    selector: string,
  ) {
    await gotoStudio(page, reference.viewPath);
    if (reference.clickButton) {
      await page.getByRole("button", { name: reference.clickButton }).click();
      if (reference.readySearchbox) {
        await expect(
          page.getByRole("searchbox", { name: reference.readySearchbox }),
        ).toBeVisible();
      }
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(500);

    const surface = page.locator(selector).first();
    await expect(surface).toBeVisible();
    const box = await surface.boundingBox();
    expect(box, `${reference.id}: ${selector} bounds`).not.toBeNull();

    // Crop both full-page screenshots on the same device-pixel grid. Locator
    // screenshots expand fractional CSS bounds differently at high DPR, which
    // would otherwise create false diffs against the frozen full-page capture.
    const x = Math.round(box!.x * referenceDeviceScaleFactor);
    const y = Math.round(box!.y * referenceDeviceScaleFactor);
    const width = Math.round(box!.width * referenceDeviceScaleFactor);
    const height = Math.round(box!.height * referenceDeviceScaleFactor);
    const actualScreen = PNG.sync.read(
      await page.screenshot({ type: "png", scale: "device" }),
    );
    const actual = new PNG({ width, height });
    PNG.bitblt(actualScreen, actual, x, y, width, height, 0, 0);
    const referenceScreen = PNG.sync.read(
      readFileSync(
        resolve(referenceDirectory, `${reference.id}-chromium-darwin.png`),
      ),
    );
    const expected = new PNG({ width, height });
    PNG.bitblt(referenceScreen, expected, x, y, width, height, 0, 0);

    expect(actual.width, `${reference.id}: screenshot width`).toBe(
      expected.width,
    );
    expect(actual.height, `${reference.id}: screenshot height`).toBe(
      expected.height,
    );

    const changedPixels = pixelmatch(
      expected.data,
      actual.data,
      undefined,
      expected.width,
      expected.height,
      { includeAA: false, threshold: 0.1 },
    );
    expect(
      changedPixels / (expected.width * expected.height),
      `${reference.id}: ${selector} changed pixel ratio`,
    ).toBeLessThanOrEqual(maxDiffPixelRatio);
  }

  for (const reference of contentScrollAreaReferenceRoutes) {
    test(`ContentScrollArea retains ${reference.id} pixels`, async ({
      page,
    }) => {
      await expectFrozenSurfaceParity(
        page,
        reference,
        "[data-content-scroll-area]",
      );
    });
  }

  for (const reference of appShellReferenceRoutes) {
    test(`AppShell retains ${reference.id} header pixels`, async ({ page }) => {
      await expectFrozenSurfaceParity(
        page,
        reference,
        "[data-slot=studio-workspace-header]",
      );
    });
  }

  for (const reference of searchFilterBarReferenceRoutes) {
    test(`SearchFilterBar retains ${reference.id} pixels`, async ({ page }) => {
      await expectFrozenSurfaceParity(page, reference, ".cv-search-filter-bar");
    });
  }
});
