# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> app workflow >> loads saved ledger, persists edits, renders all tabs, and collapses sidebar
- Location: e2e/app.spec.ts:21:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.scroll-container.no-bars')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.scroll-container.no-bars')

```

```yaml
- text: B
- paragraph: Beancount Studio
- paragraph: beancount-js-studio
- button "Ledger settings":
  - img
- button "Projects":
  - img
- button "Workspace":
  - img
- button "Search":
  - img
- paragraph: Ledgers
- text: "4"
- button "Ledgers" [pressed]
- button "Folders"
- button "Tags"
- img
- textbox:
  - /placeholder: Search ledgers
- button "Collapse all ledgers":
  - img
- button "Expand E2E Test Ledger":
  - img
- button "E2E Test Ledger":
  - img
  - text: E2E Test Ledger
- button "Expand Account Ledger":
  - img
- button "Account Ledger":
  - img
  - text: Account Ledger
- button "Expand Example with budgets":
  - img
- button "Example with budgets":
  - img
  - text: Example with budgets
- button "Collapse E2E Test Ledger" [expanded]:
  - img
- button "E2E Test Ledger":
  - img
  - text: E2E Test Ledger
- button "Dashboard":
  - img
  - text: Dashboard
- button "Editor":
  - img
  - text: Editor
- button "Income Statement":
  - img
  - text: Income Statement
- button "Balance Sheet":
  - img
  - text: Balance Sheet
- button "Trial Balance":
  - img
  - text: Trial Balance
- button "Journal":
  - img
  - text: Journal
- button "Holdings":
  - img
  - text: Holdings
- button "Statistics":
  - img
  - text: Statistics
- button "Query":
  - img
  - text: Query
- paragraph: Ledger tools
- combobox: Select account
- slider "Resize sidebar"
- main:
  - button "Collapse sidebar to project rail":
    - img
    - text: Toggle Sidebar
  - text: Holdings
  - button "Toggle theme":
    - img
    - img
  - tablist:
    - tab "Holdings" [selected]
    - tab "Holdings by Account"
    - tab "Holdings by Currency"
    - tab "Holdings by Cost currency"
  - tabpanel "Holdings":
    - link "Query":
      - /url: /beancount-js-studio/ledger/sample/query/?qs=SELECT+account%2C%0A++++++++++++++++units%28sum%28position%29%29+AS+units%2C%0A++++++++++++++++cost_number+AS+cost%2C%0A++++++++++++++++first%28getprice%28currency%2C+cost_currency%29%29+AS+price%2C%0A++++++++++++++++cost%28sum%28position%29%29+AS+book_value%2C%0A++++++++++++++++value%28sum%28position%29%29+AS+market_value%2C%0A++++++++++++++++cost_date+AS+acquisition_date%0A++++++++++++WHERE+account_sortkey%28account%29+%7E+%27%5E%5B01%5D%27%0A++++++++++++GROUP+BY+account%2C+cost_date%2C+currency%2C+cost_currency%2C+cost_number%2C+account_sortkey%28account%29%0A++++++++++++ORDER+BY+account_sortkey%28account%29%2C+currency%2C+cost_date
    - list:
      - listitem:
        - paragraph: account units cost price book_value market_value acquisition_date
      - listitem:
        - paragraph:
          - link "Assets:Checking":
            - /url: /beancount-js-studio/ledger/sample/account/Assets%3AChecking/
          - text: "-5 USD −5.00 -5 USD"
- button "Open ledger AI":
  - img
- text: Beancount Studio
```

# Test source

```ts
  258 | const navPaths: Record<string, string> = {
  259 |   Editor: "editor",
  260 |   "Income Statement": "income-statement",
  261 |   "Balance Sheet": "balance-sheet",
  262 |   "Trial Balance": "trial-balance",
  263 |   Journal: "journal",
  264 |   Holdings: "holdings",
  265 |   Statistics: "statistics",
  266 |   Query: "query",
  267 | };
  268 | 
  269 | export async function navigateTo(page: Page, label: string) {
  270 |   if (!navPaths[label]) {
  271 |     throw new Error(`Unknown nav label: ${label}`);
  272 |   }
  273 |   const panel = page
  274 |     .locator("[data-ledger-file-panels] button")
  275 |     .filter({ hasText: label })
  276 |     .first();
  277 |   await expect(panel).toBeVisible();
  278 |   await panel.click();
  279 | }
  280 | 
  281 | export async function getSidebarWidth(page: Page) {
  282 |   return page.evaluate(() => {
  283 |     const sidebar = document.querySelector<HTMLElement>(
  284 |       "[data-sidebar=sidebar]",
  285 |     );
  286 |     return sidebar?.parentElement?.getBoundingClientRect().width ?? 0;
  287 |   });
  288 | }
  289 | 
  290 | /** Match `/{projectId}/ledger/{stem}/<view>/` */
  291 | const projectView = (view: string) =>
  292 |   new RegExp(`/.+/ledger/.+/${view}/?(?:\\?.*)?$`);
  293 | 
  294 | export const mainTabs = [
  295 |   {
  296 |     name: "Editor",
  297 |     path: projectView("editor"),
  298 |     assert: async (page: Page) => {
  299 |       await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
  300 |       await expect(page.locator(".beancount-editor .cm-content")).toContainText(
  301 |         "E2E Test Ledger",
  302 |       );
  303 |       await expect(page.locator(".beancount-editor .cm-content")).toContainText(
  304 |         "saved-by-e2e",
  305 |       );
  306 |     },
  307 |   },
  308 |   {
  309 |     name: "Income Statement",
  310 |     path: projectView("income-statement"),
  311 |     assert: async (page: Page) => {
  312 |       await expect(
  313 |         page.locator("[data-statement-summary-tree-table]").first(),
  314 |       ).toBeVisible();
  315 |       await expect(
  316 |         page.getByRole("link", { name: "Expenses", exact: true }),
  317 |       ).toBeVisible();
  318 |     },
  319 |   },
  320 |   {
  321 |     name: "Balance Sheet",
  322 |     path: projectView("balance-sheet"),
  323 |     assert: async (page: Page) => {
  324 |       await expect(
  325 |         page.locator("[data-statement-summary-tree-table]").first(),
  326 |       ).toBeVisible();
  327 |       await expect(
  328 |         page.getByRole("link", { name: "Assets", exact: true }),
  329 |       ).toBeVisible();
  330 |     },
  331 |   },
  332 |   {
  333 |     name: "Trial Balance",
  334 |     path: projectView("trial-balance"),
  335 |     assert: async (page: Page) => {
  336 |       await expect(
  337 |         page.locator("[data-statement-summary-tree-table]").first(),
  338 |       ).toBeVisible();
  339 |     },
  340 |   },
  341 |   {
  342 |     name: "Journal",
  343 |     path: projectView("journal"),
  344 |     assert: async (page: Page) => {
  345 |       await expect(page.locator("[data-journal-table]")).toBeVisible();
  346 |       await expect(
  347 |         page.getByRole("button", { name: "Edit Coffee Shop" }).first(),
  348 |       ).toBeVisible();
  349 |     },
  350 |   },
  351 |   {
  352 |     name: "Holdings",
  353 |     path: projectView("holdings"),
  354 |     assert: async (page: Page) => {
  355 |       await expect(
  356 |         page.getByRole("tab", { name: "Holdings", exact: true }),
  357 |       ).toBeVisible();
> 358 |       await expect(page.locator(".scroll-container.no-bars")).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  359 |     },
  360 |   },
  361 |   {
  362 |     name: "Statistics",
  363 |     path: projectView("statistics"),
  364 |     assert: async (page: Page) => {
  365 |       await expect(page.getByText("Postings per Account")).toBeVisible();
  366 |     },
  367 |   },
  368 |   {
  369 |     name: "Query",
  370 |     path: projectView("query"),
  371 |     assert: async (page: Page) => {
  372 |       await expect(page.locator(".beancount-editor .cm-editor")).toBeVisible();
  373 |       await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  374 |     },
  375 |   },
  376 | ] as const;
  377 | 
```