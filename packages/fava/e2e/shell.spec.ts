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
      page.getByRole("button", { name: "Collapse sidebar to project rail" }),
    ).toBeVisible();
    await expect(
      workspaceHeader.getByRole("button", { name: "Toggle sidebar" }),
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
        sidebarToken: root.getPropertyValue("--sidebar").trim(),
      };
    });

    expect(lightShell.font).toContain("DM Sans Variable");
    expect(lightShell.sidebar).toEqual({ x: 0, y: 0, width: 256 });
    expect(lightShell.main).toEqual({ x: 256, y: 8, radius: "14px" });
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
    await expect(
      page.locator("[data-slot=search-tab] .cm-line-editor"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Projects" }).click();
    await expect(
      page.getByText("Current project", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /beancount-js-studio/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Workspace" }).click();

    const resizer = page.getByRole("slider", { name: "Resize sidebar" });
    const resizerBounds = await resizer.boundingBox();
    expect(resizerBounds).not.toBeNull();
    expect(resizerBounds!.y).toBe(16);
    expect(resizerBounds!.y + resizerBounds!.height).toBe(884);
    await page.mouse.move(
      resizerBounds!.x + resizerBounds!.width / 2,
      resizerBounds!.y + resizerBounds!.height / 2,
    );
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

    await page
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
    await expect(page.getByRole("link", { name: "Editor" })).toBeVisible();
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
