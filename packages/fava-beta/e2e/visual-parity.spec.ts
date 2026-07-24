import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { gotoStudio, sampleLedger, seedLedger } from "./helpers";

const referenceDirectory = resolve(
  "../ui/tests/visual/storybook.spec.ts-snapshots/fava-reference/screens",
);
const maxDiffPixelRatio = 0.001;

const affectedReferenceRoutes = [
  { id: "account-detail", viewPath: "/account/Assets:Checking" },
  { id: "dashboard", viewPath: "/dashboard" },
  { id: "query", viewPath: "/query" },
  { id: "income-statement", viewPath: "/income_statement" },
  { id: "balance-sheet", viewPath: "/balance_sheet" },
  { id: "trial-balance", viewPath: "/trial_balance" },
] as const;

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

  for (const reference of affectedReferenceRoutes) {
    test(`ContentScrollArea retains ${reference.id} pixels`, async ({
      page,
    }) => {
      await gotoStudio(page, reference.viewPath);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.waitForTimeout(500);

      const scrollArea = page.locator("[data-content-scroll-area]").first();
      await expect(scrollArea).toBeVisible();
      const box = await scrollArea.boundingBox();
      expect(box, `${reference.id}: content scroll area bounds`).not.toBeNull();

      const actual = PNG.sync.read(
        await scrollArea.screenshot({ type: "png", scale: "device" }),
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
        `${reference.id}: changed pixel ratio`,
      ).toBeLessThanOrEqual(maxDiffPixelRatio);
    });
  }
});
