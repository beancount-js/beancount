import { expect, type Page, type APIRequestContext } from "@playwright/test";
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

let cachedProjectId: string | undefined;
let cachedLedgerStem: string | undefined;
let cachedEntryFile: string | undefined;

function apiOf(request: APIRequestContext | Page): APIRequestContext {
  return "request" in request && typeof request.request === "object"
    ? (request as Page).request
    : (request as APIRequestContext);
}

/** Active/default project slug from the Studio registry. */
export async function resolveProjectId(
  request: APIRequestContext | Page,
): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  const api = apiOf(request);
  const response = await api.get("/api/projects");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(
    Array.isArray(body),
    "expected /api/projects to return a project array",
  ).toBeTruthy();
  const projects = body as Array<{ id: string; entryFile?: string }>;
  const id = projects[0]?.id;
  expect(id, "expected at least one registered project").toBeTruthy();
  cachedProjectId = id!;
  const entry = projects[0]?.entryFile ?? "sample.beancount";
  cachedEntryFile = entry;
  cachedLedgerStem = entry.replace(/\.(beancount|bean|ledger)$/i, "");
  return cachedProjectId;
}

export async function resolveLedgerStem(
  request: APIRequestContext | Page,
): Promise<string> {
  if (cachedLedgerStem) return cachedLedgerStem;
  await resolveProjectId(request);
  return cachedLedgerStem!;
}

export async function resolveEntryFile(
  request: APIRequestContext | Page,
): Promise<string> {
  if (cachedEntryFile) return cachedEntryFile;
  await resolveProjectId(request);
  return cachedEntryFile!;
}

function fileApiPath(projectId: string, entryFile: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/files/${entryFile
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** Read the active project's entry ledger via the files API. */
export async function readProjectLedger(
  request: APIRequestContext | Page,
): Promise<string> {
  const api = apiOf(request);
  const projectId = await resolveProjectId(request);
  const entryFile = await resolveEntryFile(request);
  const response = await api.get(fileApiPath(projectId, entryFile));
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { contents?: string };
  return body.contents ?? "";
}

/** Write the active project's entry ledger via the files API. */
export async function writeProjectLedger(
  request: APIRequestContext | Page,
  contents: string,
) {
  const api = apiOf(request);
  const projectId = await resolveProjectId(request);
  const entryFile = await resolveEntryFile(request);
  const response = await api.put(fileApiPath(projectId, entryFile), {
    data: { contents },
  });
  expect(response.ok()).toBeTruthy();
}

/**
 * Map legacy hash view paths to URL view segments. Accepts `/journal`,
 * `/income_statement`, `/account/Assets:Checking`, etc.
 */
function viewSegmentFromPath(viewPath: string): string {
  const raw = viewPath.replace(/^#/, "");
  const [pathname = "/journal", search = ""] = raw.includes("?")
    ? (() => {
        const index = raw.indexOf("?");
        return [raw.slice(0, index), raw.slice(index)] as const;
      })()
    : ([raw, ""] as const);
  const clean = pathname.replace(/\/+$/, "") || "/journal";
  const map: Record<string, string> = {
    "/dashboard": "dashboard",
    "/editor": "editor",
    "/income_statement": "income-statement",
    "/balance_sheet": "balance-sheet",
    "/trial_balance": "trial-balance",
    "/journal": "journal",
    "/holdings": "holdings",
    "/statistics": "statistics",
    "/query": "query",
    "/errors": "errors",
    "/accounts": "accounts",
    "/records": "records",
    "/resource": "resource",
    "/import/editor": "settings",
    "/import/accounts": "settings/accounts",
    "/import/merchants": "settings/merchants",
    "/import/manage-merchants": "settings/manage-merchants",
    "/import/brands": "settings/brands",
    "/import/history": "settings/history",
    "/import/rules": "settings/rules",
  };
  let segment = map[clean];
  if (!segment && clean.startsWith("/account/")) {
    segment = `account/${encodeURIComponent(clean.slice("/account/".length))}`;
  }
  if (!segment) {
    segment = clean.replace(/^\//, "").replaceAll("_", "-");
  }
  return `${segment}${search}`;
}

/** Build `/{projectId}/ledger/{stem}/{view}/` URLs. */
export function studioUrl(
  projectId: string,
  viewPath: string,
  ledgerStem = "sample",
) {
  const view = viewSegmentFromPath(
    viewPath.startsWith("/") || viewPath.startsWith("#")
      ? viewPath
      : `/${viewPath}`,
  );
  const [viewPathname, search = ""] = view.includes("?")
    ? (() => {
        const index = view.indexOf("?");
        return [view.slice(0, index), view.slice(index)] as const;
      })()
    : ([view, ""] as const);
  return `/${encodeURIComponent(projectId)}/ledger/${ledgerStem
    .split("/")
    .map(encodeURIComponent)
    .join("/")}/${viewPathname}/${search}`;
}

export async function gotoStudio(page: Page, viewPath: string) {
  const projectId = await resolveProjectId(page);
  let ledgerStem = await resolveLedgerStem(page);
  let path = viewPath;
  const ledgerMatch = viewPath.match(/[?&]ledger=([^&]+)/);
  if (ledgerMatch) {
    const ledger = decodeURIComponent(ledgerMatch[1]!);
    ledgerStem = ledger.replace(/\.(beancount|bean|ledger)$/i, "");
    path = viewPath
      .replace(/([?&])ledger=[^&]+/, "$1")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "")
      .replace(/\?$/, "");
  }
  const url = studioUrl(projectId, path, ledgerStem);
  await page.goto(url);
  // SPA hydrates after document load; cold Vite can take several seconds before Main mounts.
  await expect(page.locator("[data-slot=studio-workspace-header]")).toBeVisible(
    {
      timeout: 30_000,
    },
  );
  return projectId;
}

/**
 * Seed the project's on-disk entry ledger (replaces legacy localStorage
 * seeding).
 */
export async function seedLedger(page: Page, ledger: string) {
  await writeProjectLedger(page, ledger);
}

/** Reset the project entry ledger to the canonical sample fixture. */
export async function restoreSampleLedger(page: Page) {
  await writeProjectLedger(page, sampleLedger);
}

/** Clear the project entry ledger to an empty string. */
export async function clearLedger(page: Page) {
  await writeProjectLedger(page, "");
}

export async function openEditor(page: Page) {
  await gotoStudio(page, "/editor");
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
  if (marker) {
    await expect
      .poll(async () => readProjectLedger(page), { timeout: 10_000 })
      .toContain(marker);
  } else {
    // Wait a beat for the PUT to land when the caller asserts contents separately.
    await page.waitForTimeout(500);
  }
}

/** @deprecated Use saveLedgerWithButton */
export async function saveLedger(page: Page) {
  await saveLedgerWithButton(page);
}

const navPaths: Record<string, string> = {
  Editor: "editor",
  "Income Statement": "income-statement",
  "Balance Sheet": "balance-sheet",
  "Trial Balance": "trial-balance",
  Journal: "journal",
  Holdings: "holdings",
  Statistics: "statistics",
  Query: "query",
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

/** Match `/{projectId}/ledger/{stem}/<view>/` */
const projectView = (view: string) =>
  new RegExp(`/.+/ledger/.+/${view}/?(?:\\?.*)?$`);

export const mainTabs = [
  {
    name: "Editor",
    path: projectView("editor"),
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
    path: projectView("income-statement"),
    assert: async (page: Page) => {
      await expect(
        page.locator("[data-statement-summary-tree-table]").first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Expenses", exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "Balance Sheet",
    path: projectView("balance-sheet"),
    assert: async (page: Page) => {
      await expect(
        page.locator("[data-statement-summary-tree-table]").first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Assets", exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "Trial Balance",
    path: projectView("trial-balance"),
    assert: async (page: Page) => {
      await expect(
        page.locator("[data-statement-summary-tree-table]").first(),
      ).toBeVisible();
    },
  },
  {
    name: "Journal",
    path: projectView("journal"),
    assert: async (page: Page) => {
      await expect(page.locator("[data-journal-table]")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Edit Coffee Shop" }).first(),
      ).toBeVisible();
    },
  },
  {
    name: "Holdings",
    path: projectView("holdings"),
    assert: async (page: Page) => {
      await expect(
        page.getByRole("tab", { name: "Holdings", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator("[data-content-scroll-area]").first(),
      ).toBeVisible();
    },
  },
  {
    name: "Statistics",
    path: projectView("statistics"),
    assert: async (page: Page) => {
      await expect(page.getByText("Postings per Account")).toBeVisible();
    },
  },
  {
    name: "Query",
    path: projectView("query"),
    assert: async (page: Page) => {
      await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
      await expect(
        page
          .locator(".beancount-editor")
          .getByRole("button", { name: "Search" }),
      ).toBeVisible();
    },
  },
] as const;
