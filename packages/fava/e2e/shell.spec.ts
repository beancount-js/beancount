import { expect, test } from "@playwright/test";

test.describe("Docs-shell visual foundation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/#/editor");
    await expect(
      page
        .locator("[data-slot=studio-workspace-header]")
        .getByText("beancount-js-studio", { exact: true }),
    ).toBeVisible();
  });

  test("matches desktop shell geometry and persists the chosen theme", async ({
    page,
  }) => {
    const workspaceHeader = page.locator("[data-slot=studio-workspace-header]");
    await expect(
      workspaceHeader.getByRole("button", { name: "Toggle theme" }),
    ).toBeVisible();
    await expect(
      workspaceHeader.getByRole("button", {
        name: "Collapse sidebar to project rail",
      }),
    ).toBeVisible();
    await expect(
      workspaceHeader
        .getByRole("button", { name: "Collapse sidebar to project rail" })
        .locator("svg.lucide-panel-left"),
    ).toBeVisible();
    await expect(
      page
        .locator("[data-sidebar=header]")
        .getByRole("button", { name: "Toggle theme" }),
    ).toHaveCount(0);
    const appName = page
      .locator("[data-sidebar=header]")
      .getByText("Beancount Studio", { exact: true });
    await expect(appName).toBeVisible();
    expect(
      await appName.evaluate((element) =>
        Boolean(element.scrollWidth <= element.clientWidth),
      ),
    ).toBe(true);
    await expect(
      workspaceHeader.locator("button:visible").first(),
    ).toHaveAttribute("aria-label", "Collapse sidebar to project rail");

    const lightShell = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>(
        "[data-sidebar=sidebar]",
      )!;
      const sidebarFrame = sidebar.parentElement!;
      const main = document.querySelector<HTMLElement>("main")!;
      const sidebarRect = sidebarFrame.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const root = getComputedStyle(document.documentElement);

      return {
        font: getComputedStyle(document.body).fontFamily,
        sidebar: {
          x: sidebarRect.x,
          y: sidebarRect.y,
          width: sidebarRect.width,
        },
        main: {
          x: mainRect.x,
          y: mainRect.y,
          radius: getComputedStyle(main).borderRadius,
        },
        sidebarBorder: getComputedStyle(sidebarFrame).borderRightWidth,
        sidebarToken: root.getPropertyValue("--sidebar").trim(),
      };
    });

    expect(lightShell.font).toContain("DM Sans Variable");
    expect(lightShell.sidebar).toEqual({ x: 0, y: 0, width: 256 });
    expect(lightShell.main).toEqual({ x: 256, y: 8, radius: "14px" });
    expect(lightShell.sidebarBorder).toBe("0px");
    expect(lightShell.sidebarToken).toBe("oklch(98.5% 0.008 295)");

    const tabBounds = await Promise.all(
      ["Projects", "Workspace", "Search"].map((name) =>
        page.getByRole("button", { name }).boundingBox(),
      ),
    );
    expect(tabBounds.every((bounds) => bounds)).toBe(true);
    const tabWidths = tabBounds.map((bounds) => bounds!.width);
    expect(Math.max(...tabWidths) - Math.min(...tabWidths)).toBeLessThan(1);

    await page.getByRole("button", { name: "Search" }).click();
    const searchTab = page.locator("[data-slot=search-tab]");
    await expect(searchTab.locator(".cm-line-editor")).toBeVisible();
    await expect(
      searchTab.getByRole("button", { name: "Clear search" }),
    ).toHaveCount(0);
    await expect(searchTab.locator(".cm-scroller")).toHaveCSS(
      "scrollbar-gutter",
      "auto",
    );
    await expect(searchTab.locator(".cm-scroller")).toHaveCSS(
      "scrollbar-width",
      "none",
    );
    await searchTab.getByRole("textbox").fill("income");
    await expect(
      searchTab.getByRole("button", { name: "Clear search" }),
    ).toBeVisible();
    await searchTab.getByRole("button", { name: "Clear search" }).click();
    await expect(
      searchTab.getByRole("button", { name: "Clear search" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Projects" }).click();
    await expect(
      page.getByText("Current project", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /beancount-js-studio/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Workspace" }).click();
    await expect(
      page.getByRole("button", { name: "Ledgers", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Folders", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tags", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Folders", exact: true }).click();
    await expect(page.getByPlaceholder("Search folders")).toBeVisible();
    const packagesFolder = page.locator('[data-ledger-folder-row="packages"]');
    await expect(packagesFolder).toHaveAttribute("aria-expanded", "false");
    await packagesFolder.click();
    await expect(packagesFolder).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.locator('[data-ledger-folder-children="packages"]'),
    ).toContainText("fava");
    await page.getByRole("button", { name: "Ledgers", exact: true }).click();
    await expect(page.getByPlaceholder("Search ledgers")).toBeVisible();
    const collapsedLedger = page
      .locator('[data-ledger-file-toggle][aria-expanded="false"]')
      .first();
    await expect(collapsedLedger).toBeVisible();
    const collapsedLedgerPath = await collapsedLedger.getAttribute(
      "data-ledger-file-toggle",
    );
    expect(collapsedLedgerPath).toBeTruthy();
    const expandedLedger = page.locator(
      `[data-ledger-file-toggle="${collapsedLedgerPath}"]`,
    );
    await expandedLedger.click();
    await expect(expandedLedger).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.locator(`[data-ledger-file-panels="${collapsedLedgerPath}"]`),
    ).toContainText("Editor");
    const selectedLedger = page.locator(
      `[data-ledger-file-row="${collapsedLedgerPath}"]`,
    );
    await selectedLedger.click();
    await expect(selectedLedger).not.toHaveAttribute("aria-current");
    await expect(page).toHaveURL(/#\/journal$/);
    const selectedLedgerPanels = page.locator(
      `[data-ledger-file-panels="${collapsedLedgerPath}"]`,
    );
    await expect(
      selectedLedgerPanels.getByRole("button", {
        name: "Journal",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    await selectedLedgerPanels
      .getByRole("button", { name: "Editor", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/editor$/);
    await expect(
      page.locator("[data-ledger-file-panels]").first(),
    ).toContainText("Editor");

    const viewportScroll = await page.evaluate(() => ({
      document: {
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
      },
      contentAreas: document.querySelectorAll("[data-content-scroll-area]")
        .length,
    }));
    expect(viewportScroll.document.scrollHeight).toBe(
      viewportScroll.document.clientHeight,
    );
    expect(viewportScroll.contentAreas).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Tags", exact: true }).click();
    const leafTag = page.locator('[data-ledger-tag-row="credit-card"]');
    await expect(leafTag).toBeVisible();
    await expect(
      leafTag.locator("xpath=../span[contains(@class, 'size-7')]"),
    ).toHaveCount(0);
    await leafTag.click();
    await expect(
      page.getByRole("button", { name: "Remove #credit-card filter" }),
    ).toBeVisible();

    const resizer = page.getByRole("slider", { name: "Resize sidebar" });
    const resizerBounds = await resizer.boundingBox();
    expect(resizerBounds).not.toBeNull();
    expect(resizerBounds!.y).toBe(16);
    expect(resizerBounds!.y + resizerBounds!.height).toBe(884);
    const resizerLine = resizer.locator("span");
    await expect(resizerLine).toHaveClass(/bg-transparent/);
    await page.mouse.move(100, resizerBounds!.y + resizerBounds!.height / 2);
    await expect(resizerLine).toHaveClass(/bg-transparent/);
    await page.mouse.move(
      resizerBounds!.x + resizerBounds!.width / 2,
      resizerBounds!.y + resizerBounds!.height / 2,
    );
    await expect(resizerLine).toHaveClass(/bg-primary\/60/);
    await page.mouse.down();
    await page.mouse.move(
      resizerBounds!.x + resizerBounds!.width / 2 + 80,
      resizerBounds!.y + resizerBounds!.height / 2,
    );
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector<HTMLElement>("main")!.getBoundingClientRect()
              .x,
        ),
      )
      .toBe(336);

    await workspaceHeader.getByRole("button", { name: "Toggle theme" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.classList.contains("dark"),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.colorScheme),
      )
      .toBe("dark");
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("mode-watcher-mode")),
      )
      .toBe("dark");
    await expect(
      workspaceHeader.getByRole("button", { name: "Toggle theme" }),
    ).toBeVisible();

    await workspaceHeader
      .getByRole("button", { name: "Collapse sidebar to project rail" })
      .click();
    await expect(
      page.getByRole("button", { name: "Expand project rail" }),
    ).toBeVisible();
    expect(
      await page
        .getByRole("button", { name: "Expand project rail" })
        .locator("span")
        .evaluate((element) => getComputedStyle(element).writingMode),
    ).toBe("vertical-rl");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .querySelector<HTMLElement>("[data-sidebar=sidebar]")!
              .parentElement!.getBoundingClientRect().width,
        ),
      )
      .toBe(48);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector<HTMLElement>("main")!.getBoundingClientRect()
              .x,
        ),
      )
      .toBe(48);

    await page.getByRole("button", { name: "Expand project rail" }).click();
    await expect(page.locator("[data-ledger-file-row]").first()).toBeVisible();
  });
});

test.describe("Docs-shell mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/#/editor");
    await expect(
      page
        .locator("[data-slot=studio-workspace-header]")
        .getByText("beancount-js-studio", { exact: true }),
    ).toBeVisible();
  });

  test("keeps the sidebar reachable at phone widths", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Show navigation" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show navigation" }).click();
    await expect(
      page.getByRole("button", { name: "Close sidebar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Toggle theme" }),
    ).toBeVisible();
  });
});
