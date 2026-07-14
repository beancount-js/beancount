import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = fileURLToPath(new URL(".", import.meta.url));

export const sampleLedger = readFileSync(
  path.join(e2eDir, "../public/sample.beancount"),
  "utf8",
);

export const minimalLedger = readFileSync(
  path.join(e2eDir, "fixtures/minimal.beancount"),
  "utf8",
);

const LEDGER_INIT_KEY = "e2e-ledger-initialized";

export async function seedLedger(page: Page, ledger: string) {
  await page.addInitScript(
    ({ contents, initKey }) => {
      if (!localStorage.getItem(initKey)) {
        localStorage.setItem("ledger", contents);
        localStorage.setItem(initKey, "1");
      }
    },
    { contents: ledger, initKey: LEDGER_INIT_KEY },
  );
}

export async function clearLedger(page: Page) {
  await page.addInitScript(
    ({ initKey }) => {
      if (!localStorage.getItem(initKey)) {
        localStorage.removeItem("ledger");
        localStorage.setItem(initKey, "1");
      }
    },
    { initKey: LEDGER_INIT_KEY },
  );
}

export async function openEditor(page: Page) {
  await page.goto("/#/editor");
  await page.waitForSelector("[data-ledger-file-row]");
}

export async function waitForEditorContent(
  page: Page,
  text: string,
  timeout = 15_000,
) {
  await expect(page.locator(".beancount-editor .cm-content")).toContainText(
    text,
    { timeout },
  );
}

export async function appendEditorLine(page: Page, line: string) {
  const editor = page.locator(".beancount-editor .cm-content");
  await page.locator(".beancount-editor .cm-line").last().click();
  await page.keyboard.insertText(`\n${line}`);
  await expect(editor).toContainText(line.trim());
  const mod = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${mod}+S`);
  await page.waitForTimeout(500);
}

export async function replaceEditorContent(page: Page, content: string) {
  const mod = process.platform === "darwin" ? "Meta" : "Control";
  await page.locator(".beancount-editor .cm-content").click();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.insertText(content);
  await expect(page.locator(".beancount-editor .cm-content")).toContainText(
    content
      .trim()
      .split("\n")
      .find((line) => line.trim()) ?? content,
  );
}

export async function saveLedgerWithButton(page: Page, marker?: string) {
  await page.getByRole("button", { name: "Save Ledger" }).click();
  await page.waitForFunction(
    (expected) => {
      const stored = localStorage.getItem("ledger");
      return expected ? stored?.includes(expected) : stored != null;
    },
    marker ?? null,
    { timeout: 5_000 },
  );
}

/** @deprecated Use saveLedgerWithButton */
export async function saveLedger(page: Page) {
  await saveLedgerWithButton(page);
}

const navPaths: Record<string, string> = {
  Editor: "#/editor",
  "Income Statement": "#/income_statement",
  "Balance Sheet": "#/balance_sheet",
  "Trial Balance": "#/trial_balance",
  Journal: "#/journal",
  Holdings: "#/holdings",
  Statistics: "#/statistics",
  Query: "#/query",
};

export async function navigateTo(page: Page, label: string) {
  if (!navPaths[label]) {
    throw new Error(`Unknown nav label: ${label}`);
  }
  const panel = page
    .locator("[data-ledger-file-panels] button")
    .filter({ hasText: label })
    .first();
  await expect(panel).toBeVisible();
  await panel.click();
}

export async function getSidebarWidth(page: Page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector<HTMLElement>(
      "[data-sidebar=sidebar]",
    );
    return sidebar?.parentElement?.getBoundingClientRect().width ?? 0;
  });
}

export const mainTabs = [
  {
    name: "Editor",
    path: /#\/editor$/,
    assert: async (page: Page) => {
      await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
      await expect(page.locator(".beancount-editor .cm-content")).toContainText(
        "E2E Test Ledger",
      );
      await expect(page.locator(".beancount-editor .cm-content")).toContainText(
        "saved-by-e2e",
      );
    },
  },
  {
    name: "Income Statement",
    path: /#\/income_statement$/,
    assert: async (page: Page) => {
      await expect(page.locator(".tree-table-new").first()).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Expenses", exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "Balance Sheet",
    path: /#\/balance_sheet$/,
    assert: async (page: Page) => {
      await expect(page.locator(".tree-table-new").first()).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Assets", exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "Trial Balance",
    path: /#\/trial_balance$/,
    assert: async (page: Page) => {
      await expect(page.locator(".tree-table-new").first()).toBeVisible();
    },
  },
  {
    name: "Journal",
    path: /#\/journal$/,
    assert: async (page: Page) => {
      await expect(page.locator(".bean-table.flex-table")).toBeVisible();
      await expect(page.getByText("Coffee Shop")).toBeVisible();
    },
  },
  {
    name: "Holdings",
    path: /#\/holdings$/,
    assert: async (page: Page) => {
      await expect(
        page.getByRole("tab", { name: "Holdings", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".scroll-container.no-bars")).toBeVisible();
    },
  },
  {
    name: "Statistics",
    path: /#\/statistics$/,
    assert: async (page: Page) => {
      await expect(page.getByText("Postings per Account")).toBeVisible();
    },
  },
  {
    name: "Query",
    path: /#\/query$/,
    assert: async (page: Page) => {
      await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
      await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    },
  },
] as const;
