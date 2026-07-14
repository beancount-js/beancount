import { expect, test } from "@playwright/test";

test.describe("Docs-shell visual foundation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/#/editor");
  });

  test("matches desktop shell geometry and persists the chosen theme", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "Toggle theme" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeVisible();
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

    await page.getByRole("button", { name: "Toggle theme" }).click();
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
      page.getByRole("button", { name: "Toggle theme" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(
      page.getByRole("button", { name: "Expand sidebar" }),
    ).toBeVisible();
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
  });
});

test.describe("Docs-shell mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/#/editor");
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
