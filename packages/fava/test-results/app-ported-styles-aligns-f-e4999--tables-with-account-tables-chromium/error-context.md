# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> ported styles >> aligns financial-statement hierarchy tables with account tables
- Location: e2e/app.spec.ts:76:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-slot=studio-workspace-header]')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('[data-slot=studio-workspace-header]')

```

# Test source

```ts
  83  |   const body = (await response.json()) as { contents?: string };
  84  |   return body.contents ?? "";
  85  | }
  86  | 
  87  | /** Write the active project's entry ledger via the files API. */
  88  | export async function writeProjectLedger(
  89  |   request: APIRequestContext | Page,
  90  |   contents: string,
  91  | ) {
  92  |   const api = apiOf(request);
  93  |   const projectId = await resolveProjectId(request);
  94  |   const entryFile = await resolveEntryFile(request);
  95  |   const response = await api.put(fileApiPath(projectId, entryFile), {
  96  |     data: { contents },
  97  |   });
  98  |   expect(response.ok()).toBeTruthy();
  99  | }
  100 | 
  101 | /**
  102 |  * Map legacy hash view paths to URL view segments. Accepts `/journal`,
  103 |  * `/income_statement`, `/account/Assets:Checking`, etc.
  104 |  */
  105 | function viewSegmentFromPath(viewPath: string): string {
  106 |   const raw = viewPath.replace(/^#/, "");
  107 |   const [pathname = "/journal", search = ""] = raw.includes("?")
  108 |     ? (() => {
  109 |         const index = raw.indexOf("?");
  110 |         return [raw.slice(0, index), raw.slice(index)] as const;
  111 |       })()
  112 |     : ([raw, ""] as const);
  113 |   const clean = pathname.replace(/\/+$/, "") || "/journal";
  114 |   const map: Record<string, string> = {
  115 |     "/dashboard": "dashboard",
  116 |     "/editor": "editor",
  117 |     "/income_statement": "income-statement",
  118 |     "/balance_sheet": "balance-sheet",
  119 |     "/trial_balance": "trial-balance",
  120 |     "/journal": "journal",
  121 |     "/holdings": "holdings",
  122 |     "/statistics": "statistics",
  123 |     "/query": "query",
  124 |     "/errors": "errors",
  125 |     "/accounts": "accounts",
  126 |     "/records": "records",
  127 |     "/resource": "resource",
  128 |     "/import/editor": "settings",
  129 |     "/import/accounts": "settings/accounts",
  130 |     "/import/merchants": "settings/merchants",
  131 |     "/import/manage-merchants": "settings/manage-merchants",
  132 |   };
  133 |   let segment = map[clean];
  134 |   if (!segment && clean.startsWith("/account/")) {
  135 |     segment = `account/${encodeURIComponent(clean.slice("/account/".length))}`;
  136 |   }
  137 |   if (!segment) {
  138 |     segment = clean.replace(/^\//, "").replaceAll("_", "-");
  139 |   }
  140 |   return `${segment}${search}`;
  141 | }
  142 | 
  143 | /** Build `/{projectId}/ledger/{stem}/{view}/` URLs. */
  144 | export function studioUrl(
  145 |   projectId: string,
  146 |   viewPath: string,
  147 |   ledgerStem = "sample",
  148 | ) {
  149 |   const view = viewSegmentFromPath(
  150 |     viewPath.startsWith("/") || viewPath.startsWith("#")
  151 |       ? viewPath
  152 |       : `/${viewPath}`,
  153 |   );
  154 |   const [viewPathname, search = ""] = view.includes("?")
  155 |     ? (() => {
  156 |         const index = view.indexOf("?");
  157 |         return [view.slice(0, index), view.slice(index)] as const;
  158 |       })()
  159 |     : ([view, ""] as const);
  160 |   return `/${encodeURIComponent(projectId)}/ledger/${ledgerStem
  161 |     .split("/")
  162 |     .map(encodeURIComponent)
  163 |     .join("/")}/${viewPathname}/${search}`;
  164 | }
  165 | 
  166 | export async function gotoStudio(page: Page, viewPath: string) {
  167 |   const projectId = await resolveProjectId(page);
  168 |   let ledgerStem = await resolveLedgerStem(page);
  169 |   let path = viewPath;
  170 |   const ledgerMatch = viewPath.match(/[?&]ledger=([^&]+)/);
  171 |   if (ledgerMatch) {
  172 |     const ledger = decodeURIComponent(ledgerMatch[1]!);
  173 |     ledgerStem = ledger.replace(/\.(beancount|bean|ledger)$/i, "");
  174 |     path = viewPath
  175 |       .replace(/([?&])ledger=[^&]+/, "$1")
  176 |       .replace(/\?&/, "?")
  177 |       .replace(/[?&]$/, "")
  178 |       .replace(/\?$/, "");
  179 |   }
  180 |   const url = studioUrl(projectId, path, ledgerStem);
  181 |   await page.goto(url);
  182 |   // SPA hydrates after document load; cold Vite can take several seconds before Main mounts.
> 183 |   await expect(page.locator("[data-slot=studio-workspace-header]")).toBeVisible(
      |                                                                     ^ Error: expect(locator).toBeVisible() failed
  184 |     {
  185 |       timeout: 30_000,
  186 |     },
  187 |   );
  188 |   return projectId;
  189 | }
  190 | 
  191 | /**
  192 |  * Seed the project's on-disk entry ledger (replaces legacy localStorage
  193 |  * seeding).
  194 |  */
  195 | export async function seedLedger(page: Page, ledger: string) {
  196 |   await writeProjectLedger(page, ledger);
  197 | }
  198 | 
  199 | /** Reset the project entry ledger to the canonical sample fixture. */
  200 | export async function restoreSampleLedger(page: Page) {
  201 |   await writeProjectLedger(page, sampleLedger);
  202 | }
  203 | 
  204 | /** Clear the project entry ledger to an empty string. */
  205 | export async function clearLedger(page: Page) {
  206 |   await writeProjectLedger(page, "");
  207 | }
  208 | 
  209 | export async function openEditor(page: Page) {
  210 |   await gotoStudio(page, "/editor");
  211 |   await page.waitForSelector("[data-ledger-file-row]");
  212 | }
  213 | 
  214 | export async function waitForEditorContent(
  215 |   page: Page,
  216 |   text: string,
  217 |   timeout = 15_000,
  218 | ) {
  219 |   await expect(page.locator(".beancount-editor .cm-content")).toContainText(
  220 |     text,
  221 |     { timeout },
  222 |   );
  223 | }
  224 | 
  225 | export async function appendEditorLine(page: Page, line: string) {
  226 |   const editor = page.locator(".beancount-editor .cm-content");
  227 |   await page.locator(".beancount-editor .cm-line").last().click();
  228 |   await page.keyboard.insertText(`\n${line}`);
  229 |   await expect(editor).toContainText(line.trim());
  230 |   const mod = process.platform === "darwin" ? "Meta" : "Control";
  231 |   await page.keyboard.press(`${mod}+S`);
  232 |   await page.waitForTimeout(500);
  233 | }
  234 | 
  235 | export async function replaceEditorContent(page: Page, content: string) {
  236 |   const mod = process.platform === "darwin" ? "Meta" : "Control";
  237 |   await page.locator(".beancount-editor .cm-content").click();
  238 |   await page.keyboard.press(`${mod}+A`);
  239 |   await page.keyboard.insertText(content);
  240 |   await expect(page.locator(".beancount-editor .cm-content")).toContainText(
  241 |     content
  242 |       .trim()
  243 |       .split("\n")
  244 |       .find((line) => line.trim()) ?? content,
  245 |   );
  246 | }
  247 | 
  248 | export async function saveLedgerWithButton(page: Page, marker?: string) {
  249 |   await page.getByRole("button", { name: "Save Ledger" }).click();
  250 |   if (marker) {
  251 |     await expect
  252 |       .poll(async () => readProjectLedger(page), { timeout: 10_000 })
  253 |       .toContain(marker);
  254 |   } else {
  255 |     // Wait a beat for the PUT to land when the caller asserts contents separately.
  256 |     await page.waitForTimeout(500);
  257 |   }
  258 | }
  259 | 
  260 | /** @deprecated Use saveLedgerWithButton */
  261 | export async function saveLedger(page: Page) {
  262 |   await saveLedgerWithButton(page);
  263 | }
  264 | 
  265 | const navPaths: Record<string, string> = {
  266 |   Editor: "editor",
  267 |   "Income Statement": "income-statement",
  268 |   "Balance Sheet": "balance-sheet",
  269 |   "Trial Balance": "trial-balance",
  270 |   Journal: "journal",
  271 |   Holdings: "holdings",
  272 |   Statistics: "statistics",
  273 |   Query: "query",
  274 | };
  275 | 
  276 | export async function navigateTo(page: Page, label: string) {
  277 |   if (!navPaths[label]) {
  278 |     throw new Error(`Unknown nav label: ${label}`);
  279 |   }
  280 |   const panel = page
  281 |     .locator("[data-ledger-file-panels] button")
  282 |     .filter({ hasText: label })
  283 |     .first();
```