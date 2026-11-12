import { expect, test } from "playwright/test";

const marker = "OPFS persistence acceptance";
const contents = `2024-01-01 open Assets:Cash\n2024-01-02 note Assets:Cash "${marker}"\n`;

test("persists a browser-workspace edit across a full reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("[data-status=ready]").waitFor();
  await page.evaluate(async () => {
    localStorage.clear();
    const root = await navigator.storage.getDirectory();
    await root
      .removeEntry("beancount-studio", { recursive: true })
      .catch(() => {});
  });
  await page.reload();

  await page.locator("[data-status=ready]").waitFor();
  await expect(
    page.getByText("Browser workspace", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Ledger source" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(contents);
  await page.getByRole("button", { name: "Save ledger" }).click();

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle("beancount-studio");
        const handle = await directory.getFileHandle("main.beancount");
        return (await handle.getFile()).text();
      }),
    )
    .toContain(marker);

  await page.reload();
  await page.locator("[data-status=ready]").waitFor();
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Ledger source" }),
  ).toContainText(marker);
});
