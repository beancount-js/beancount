import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  gotoStudio,
  resolveProjectId,
  sampleLedger,
  seedLedger,
} from "./helpers";

const exampleYaml = readFileSync(
  path.join(
    fileURLToPath(new URL(".", import.meta.url)),
    "fixtures/example-ingestion.yaml",
  ),
  "utf8",
);

async function resetIngestionConfig(page: Page) {
  const projectId = await resolveProjectId(page);
  const response = await page.request.put(
    `/api/projects/${encodeURIComponent(projectId)}/ingestion`,
    { data: { version: 1, sources: [] } },
  );
  expect(response.ok()).toBeTruthy();
}

async function seedExampleSources(page: Page) {
  const header = page.locator("[data-slot=studio-workspace-header]");
  await header.getByRole("switch", { name: "YAML mode" }).click();
  const editor = page.locator("[data-ingestion-sources-editor]");
  const sourceEditor = editor.locator("[data-code-editor=yaml]");
  await expect(sourceEditor.locator(".cm-content")).toBeVisible();
  await sourceEditor.locator(".cm-content").click();
  await page.keyboard.press(
    `${process.platform === "darwin" ? "Meta" : "Control"}+A`,
  );
  await page.keyboard.insertText(exampleYaml);
  await editor.getByRole("button", { name: "Apply YAML" }).click();
  await header.getByRole("switch", { name: "YAML mode" }).click();
  await expect(
    editor.locator("[data-ingestion-sources-preview]"),
  ).toBeVisible();
  await expect(editor.getByText("My bank")).toBeVisible();
}

async function switchToEdit(page: Page) {
  const header = page.locator("[data-slot=studio-workspace-header]");
  await header.getByRole("button", { name: "Switch to edit mode" }).click();
  await expect(
    page.locator(
      "[data-ingestion-sources-editor] [data-ingestion-source-form]",
    ),
  ).toBeVisible();
}

test.describe("ingestion sources editor", () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, sampleLedger);
    await resetIngestionConfig(page);
  });

  test("defaults to connection preview and edits in form mode", async ({
    page,
  }) => {
    await gotoStudio(page, "/import/editor");

    const editor = page.locator("[data-ingestion-sources-editor]");
    const header = page.locator("[data-slot=studio-workspace-header]");
    await expect(editor).toBeVisible();
    await expect(
      editor.locator("[data-ingestion-sources-preview]"),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      header.getByRole("button", { name: "Switch to edit mode" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Review imports" }),
    ).toBeVisible();
    await expect(
      header.getByRole("switch", { name: "YAML mode" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Collapse all source sections" }),
    ).toHaveCount(0);
    await expect(
      editor.getByRole("button", { name: "Add source" }),
    ).toHaveCount(0);
    await expect(editor.getByText(/Available ·/i)).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Connect Lunch Flow" }),
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Connect Starling Bank" }),
    ).toBeVisible();
    await editor.getByRole("button", { name: "Connect Lunch Flow" }).click();
    await expect(
      page.getByRole("dialog", { name: /Connect Lunch Flow/i }),
    ).toHaveCount(0);
    await expect(
      editor.locator("[data-ingestion-connection-card]"),
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Lunch Flow", exact: true }),
    ).toBeVisible();
    await expect(editor.getByLabel("Base URL for Lunch Flow")).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Manage accounts" }),
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Connect Lunch Flow" }),
    ).toHaveCount(0);

    await seedExampleSources(page);
    await expect(editor.getByText(/Your connections/i)).toBeVisible();
    await expect(editor.getByText(/Available ·/i)).toHaveCount(0);
    await expect(
      editor.getByRole("button", { name: "Connect Lunch Flow" }),
    ).toHaveCount(0);
    await expect(editor.getByLabel("API Key for My bank")).toBeVisible();
    await expect(editor.getByLabel("Endpoint for My bank")).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Update connection" }),
    ).toBeVisible();

    await switchToEdit(page);
    await expect(
      header.getByRole("button", { name: "Switch to preview mode" }),
    ).toBeVisible();
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

    const sourceAccount = editor.locator(
      '[data-account-field="sourceAccount"]',
    );
    await editor.getByRole("button", { name: "Collapse My bank" }).click();
    await expect(sourceAccount).toBeHidden();
    await editor.getByRole("button", { name: "Expand My bank" }).click();
    await expect(sourceAccount).toBeVisible();
    const labelBox = await sourceAccount
      .locator("xpath=ancestor::*[@role='group'][1]/span")
      .boundingBox();
    const inputBox = await sourceAccount.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    expect(Math.abs(labelBox!.y - inputBox!.y)).toBeLessThan(8);
    expect(inputBox!.x).toBeGreaterThan(labelBox!.x);

    await expect(
      header.getByRole("button", { name: "Collapse all source sections" }),
    ).toBeVisible();
    await header
      .getByRole("button", { name: "Collapse all source sections" })
      .click();
    await expect(
      header.getByRole("button", { name: "Expand all source sections" }),
    ).toBeVisible();
    await expect(editor.getByLabel("Endpoint")).toBeHidden();
    await header
      .getByRole("button", { name: "Expand all source sections" })
      .click();
    await expect(editor.getByLabel("Endpoint")).toBeVisible();

    await expect(editor.getByText("No static query parameters.")).toHaveCount(
      0,
    );
    await editor.getByRole("button", { name: "Add parameter" }).click();
    await expect(
      editor.getByRole("textbox", { name: "Query parameter 1 name" }),
    ).toBeVisible();
    await expect(editor.getByTestId("entry-header")).toBeVisible();

    const nameFieldsBeforeAdd = await editor
      .getByRole("textbox", { name: "Name" })
      .count();
    await editor.getByRole("button", { name: "Add source" }).click();
    await expect(
      editor.getByRole("textbox", { name: "Name" }).last(),
    ).toHaveValue("New source");
    page.once("dialog", (dialog) => void dialog.accept());
    await editor.getByRole("button", { name: "Remove New source" }).click();
    await expect(editor.getByRole("textbox", { name: "Name" })).toHaveCount(
      nameFieldsBeforeAdd,
    );
    await expect(
      editor.getByRole("textbox", { name: "Name" }).first(),
    ).toHaveValue(/./);

    await header.getByRole("switch", { name: "YAML mode" }).click();
    const sourceEditor = editor.locator("[data-code-editor=yaml]");
    await expect(sourceEditor.locator(".cm-content")).toContainText("version:");

    await sourceEditor.locator(".cm-content").click();
    await page.keyboard.press(
      `${process.platform === "darwin" ? "Meta" : "Control"}+A`,
    );
    await page.keyboard.insertText("{");
    await editor.getByRole("button", { name: "Apply YAML" }).click();
    await expect(editor.getByRole("alert")).toContainText("Invalid YAML");

    await editor.getByRole("button", { name: "Reset" }).click();
    await expect(sourceEditor.locator(".cm-content")).toContainText("version:");

    await header.getByRole("switch", { name: "YAML mode" }).click();
    await expect(editor.locator("[data-ingestion-source-form]")).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Save sources" }),
    ).toHaveCount(0);
    await expect(
      editor.getByRole("button", { name: "Use example" }),
    ).toHaveCount(0);
  });
});
