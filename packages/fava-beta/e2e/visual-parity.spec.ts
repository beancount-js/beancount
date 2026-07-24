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

type ReferenceRoute = {
  id: string;
  viewPath: string;
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
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(500);

    const surface = page.locator(selector).first();
    await expect(surface).toBeVisible();
    const box = await surface.boundingBox();
    expect(box, `${reference.id}: ${selector} bounds`).not.toBeNull();

    const actual = PNG.sync.read(
      await surface.screenshot({ type: "png", scale: "device" }),
    );
    const referenceScreen = PNG.sync.read(
      readFileSync(
        resolve(referenceDirectory, `${reference.id}-chromium-darwin.png`),
      ),
    );
    const expected = new PNG({ width: actual.width, height: actual.height });
    PNG.bitblt(
      referenceScreen,
      expected,
      Math.round(box!.x * 3),
      Math.round(box!.y * 3),
      actual.width,
      actual.height,
      0,
      0,
    );

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
});
