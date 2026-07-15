import { expect, test } from "@playwright/test";
import { seedLedger, sampleLedger } from "./helpers";

test.describe("ingestion sources editor", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, sampleLedger);
  });

  test("keeps form and YAML drafts separate until an explicit save", async ({
    page,
  }) => {
    await page.goto("/#/import/editor");

    const editor = page.locator("[data-ingestion-sources-editor]");
    await expect(editor).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Add source" }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await editor.locator("[data-testid=ingestion-use-example]").click();
    await expect(editor.locator("[data-ingestion-source-form]")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      editor.getByText(
        "Identify the account and ledger file this API source imports into.",
      ),
    ).toHaveCount(0);
    await expect(
      editor.getByRole("switch", { name: "Enable AI categorisation" }),
    ).toBeVisible();
    await expect(
      editor.getByRole("switch", { name: "Configure merchant enrichment" }),
    ).toBeVisible();

    await editor
      .getByRole("button", { name: "Source details", exact: true })
      .click();
    await expect(editor.locator("#ingestion-source-account")).toBeHidden();
    await editor
      .getByRole("button", { name: "Source details", exact: true })
      .click();
    await expect(editor.locator("#ingestion-source-account")).toBeVisible();
    const sourceAccount = editor.locator("#ingestion-source-account");
    const labelBox = await sourceAccount
      .locator("xpath=ancestor::label[1]/span")
      .boundingBox();
    const inputBox = await sourceAccount.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    expect(Math.abs(labelBox!.y - inputBox!.y)).toBeLessThan(8);
    expect(inputBox!.x).toBeGreaterThan(labelBox!.x);

    await expect(
      editor.getByRole("button", { name: "Collapse all source sections" }),
    ).toBeVisible();
    await editor
      .getByRole("button", { name: "Collapse all source sections" })
      .click();
    await expect(
      editor.getByRole("button", { name: "Expand all source sections" }),
    ).toBeVisible();
    await expect(editor.getByLabel("Endpoint")).toBeHidden();
    await editor
      .getByRole("button", { name: "Expand all source sections" })
      .click();
    await expect(editor.getByLabel("Endpoint")).toBeVisible();

    await editor.getByRole("button", { name: "Add source" }).click();
    await expect(
      editor.getByRole("heading", { name: "New source", exact: true }),
    ).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await editor.getByRole("button", { name: "Remove" }).click();
    await expect(
      editor.getByRole("heading", { name: "My bank", exact: true }),
    ).toBeVisible();

    await editor.getByRole("switch", { name: "YAML mode" }).click();
    const sourceEditor = editor.locator("[data-code-editor=yaml]");
    await expect(sourceEditor.locator(".cm-content")).toContainText("sources:");

    await sourceEditor.locator(".cm-content").click();
    await page.keyboard.press(
      `${process.platform === "darwin" ? "Meta" : "Control"}+A`,
    );
    await page.keyboard.insertText("{");
    await editor.getByRole("button", { name: "Apply YAML" }).click();
    await expect(editor.getByRole("alert")).toContainText("Invalid YAML");

    await editor.getByRole("button", { name: "Reset" }).click();
    await expect(sourceEditor.locator(".cm-content")).toContainText("sources:");

    await editor.getByRole("switch", { name: "YAML mode" }).click();
    await expect(editor.locator("[data-ingestion-source-form]")).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Save sources" }),
    ).toBeVisible();
  });
});
