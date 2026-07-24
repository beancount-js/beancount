import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type StoryIndexEntry = {
  id: string;
  type?: string;
  title?: string;
  tags?: string[];
};

const snapshotDirectory = resolve("tests/visual/storybook.spec.ts-snapshots");
const requestedStoryIds = new Set<string>(
  JSON.parse(process.env.VISUAL_UPDATE_STORY_IDS ?? "[]") as string[],
);

function loadVisualStories(): StoryIndexEntry[] {
  const index = JSON.parse(
    readFileSync(resolve("storybook-static/index.json"), "utf8"),
  ) as { entries?: Record<string, StoryIndexEntry> };

  return Object.values(index.entries ?? {})
    .filter((entry) => entry.type === "story")
    .filter((entry) => !entry.tags?.includes("skip-visual"))
    .filter((entry) => !entry.tags?.includes("fava-reference-visual"))
    .filter((entry) => {
      if (requestedStoryIds.size > 0) return requestedStoryIds.has(entry.id);
      return existsSync(
        resolve(snapshotDirectory, `${entry.id}-chromium-darwin.png`),
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function prepareStory(page: Page, storyId: string): Promise<void> {
  await page.goto(
    `/iframe.html?${new URLSearchParams({ id: storyId, viewMode: "story" })}`,
    { waitUntil: "networkidle" },
  );

  const root = page.locator("#storybook-root");
  await expect(root).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

const stories = loadVisualStories();

test.describe("Storybook visual baselines", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
        }
      `;
      document.documentElement.appendChild(style);
    });
  });

  if (stories.length === 0) {
    test.skip("no committed visual baselines", () => {});
  }

  for (const story of stories) {
    test(story.id, async ({ page }) => {
      await prepareStory(page, story.id);

      const root = page.locator("#storybook-root");
      const portals = page.locator(
        '[role="dialog"], [role="listbox"], [role="menu"], [data-state="open"]',
      );
      if ((await portals.count()) > 0) {
        await expect(page).toHaveScreenshot(`${story.id}.png`);
        return;
      }

      const firstChild = root.locator(":scope > *").first();
      const subject = (await firstChild.count()) > 0 ? firstChild : root;
      await expect(subject).toBeVisible();
      await expect(subject).toHaveScreenshot(`${story.id}.png`);
    });
  }
});
