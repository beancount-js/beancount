import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { createBeancountController } from "./beancount-controller.svelte";
import { createInMemorySource } from "../../catalog/controller/in-memory-source";
import { demoLedger } from "../../catalog/fixtures/project";
describe("Beancount controller", () => {
  it("loads real ledger data and maintains isolated history", async () => {
    const controller = createBeancountController({
      source: createInMemorySource(),
    });
    await controller.initialize();
    expect(controller.state.status).toBe("ready");
    expect(controller.state.ledger.transactions.length).toBe(6);
    controller.actions.navigate("/account/Assets:Checking?query=2024");
    expect(controller.state.route.params.account).toBe("Assets:Checking");
    expect(controller.state.route.query.query).toBe("2024");
    controller.actions.back();
    expect(controller.state.route.path).toBe("/dashboard");
    controller.actions.forward();
    expect(controller.state.route.params.account).toBe("Assets:Checking");
    controller.dispose();
  });
  it("saves, rebuilds the ledger, and rejects stale file revisions", async () => {
    const c = createBeancountController({ source: createInMemorySource() });
    await c.initialize();
    await c.actions.saveFile(
      "main.beancount",
      demoLedger.replaceAll("3000 GBP", "3500 GBP"),
      "1",
    );
    expect(c.state.snapshot?.revisions[0]?.revision).toBe("2");
    await expect(
      c.actions.saveFile("main.beancount", demoLedger, "1"),
    ).rejects.toThrow("File changed");
    expect(c.state.status).toBe("failed");
    await c.actions.retry();
    expect(c.state.status).toBe("ready");
    c.dispose();
  });
  it("filters the authoritative presentation context and isolates projects", async () => {
    const c = createBeancountController({ source: createInMemorySource() });
    await c.initialize();
    c.actions.setQuery("account:Expenses:Food");
    expect(get(c.presentation.query)).toBe("account:Expenses:Food");
    await c.actions.selectProject("second");
    expect(c.state.snapshot?.project.id).toBe("second");
    c.dispose();
    await expect(c.initialize()).rejects.toThrow("disposed");
  });
});

it("isolates chart preferences across controllers", () => {
  const first = createBeancountController({ source: createInMemorySource() });
  const second = createBeancountController({ source: createInMemorySource() });
  first.presentation.chart.lineChartMode.set("area");
  first.presentation.chart.chartToggledCurrencies.set(["GBP"]);
  expect(get(second.presentation.chart.lineChartMode)).toBe("line");
  expect(get(second.presentation.chart.chartToggledCurrencies)).toEqual([]);
  first.dispose();
  second.dispose();
});

it("keeps workspace selection and query history bound to one controller", async () => {
  const first = createBeancountController({ source: createInMemorySource() });
  const second = createBeancountController({ source: createInMemorySource() });
  await Promise.all([first.initialize(), second.initialize()]);
  first.workspace.activeFile.set("empty.beancount");
  expect(first.state.activeFile).toBe("empty.beancount");
  expect(second.state.activeFile).toBe("main.beancount");
  first.actions.navigate("/journal");
  first.navigation.router.updateState("?view=upcoming");
  expect(first.state.route.path).toBe("/journal");
  expect(first.state.route.query.view).toBe("upcoming");
  const resource = await first.actions.resourceUrl("receipts/example.txt");
  expect(resource.text).toContain("Groceries");
  const response = await first.actions.request(
    "/api/projects/example/ingestion/merchants",
  );
  const merchants = await response.json();
  expect(merchants).toHaveLength(4);
  expect(merchants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ canonicalName: "Example cafe" }),
      expect.objectContaining({ canonicalName: "Example bank" }),
      expect.objectContaining({ canonicalName: "Fixture provider" }),
      expect.objectContaining({
        canonicalName: "American Express",
        provenance: expect.arrayContaining([
          expect.objectContaining({ source: "brandfetch" }),
        ]),
      }),
    ]),
  );
  first.dispose();
  second.dispose();
  await expect(
    first.actions.request("/api/projects/example/ingestion"),
  ).rejects.toThrow("disposed");
});

it("aborts streamed services when disposed even after response headers arrive", async () => {
  const captured: { signal?: AbortSignal | null } = {};
  const controller = createBeancountController({
    source: {
      ...createInMemorySource(),
      async request(_url, init) {
        captured.signal = init?.signal;
        return new Response("stream");
      },
    },
  });
  await controller.actions.request("/api/projects/example/ai");
  expect(captured.signal?.aborted).toBe(false);
  controller.dispose();
  expect(captured.signal?.aborted).toBe(true);
});

it("preserves the reference root and run audit route semantics", async () => {
  const controller = createBeancountController({
    source: createInMemorySource(),
    initialRoute: "/",
  });
  expect(controller.state.route.path).toBe("/balance_sheet");
  controller.actions.navigate("/import/history/import-2024");
  expect(controller.state.route.params.runId).toBe("import-2024");
  controller.dispose();
});

it("restores project, ledger, route and query as one history selection", async () => {
  const c = createBeancountController({ source: createInMemorySource() });
  await c.initialize();
  c.actions.navigate("/journal?query=account%3AExpenses%3AFood");
  c.actions.selectFile("empty.beancount");
  await c.actions.selectProject("second");
  c.actions.navigate("/query?qs=SELECT%20account");
  c.actions.back();
  c.actions.back();
  expect(c.state.snapshot?.project.id).toBe("example");
  expect(c.state.activeFile).toBe("empty.beancount");
  expect(c.state.route.path).toBe("/journal");
  expect(get(c.presentation.query)).toBe("account:Expenses:Food");
  c.actions.back();
  expect(c.state.activeFile).toBe("main.beancount");
  c.actions.forward();
  c.actions.forward();
  c.actions.forward();
  expect(c.state.snapshot?.project.id).toBe("second");
  expect(get(c.presentation.bqlQuery)).toBe("SELECT account");
  c.dispose();
});

it("keeps refresh on the selected ledger without adding history", async () => {
  const c = createBeancountController({ source: createInMemorySource() });
  await c.initialize();
  c.actions.selectFile("empty.beancount");
  await c.actions.refresh();
  expect(c.state.activeFile).toBe("empty.beancount");
  c.actions.back();
  expect(c.state.activeFile).toBe("main.beancount");
  expect(c.state.canNavigateBack).toBe(false);
  c.dispose();
});

it("restores the full selection after settings and bridges legacy settings actions", async () => {
  const c = createBeancountController({ source: createInMemorySource() });
  await c.initialize();
  c.actions.selectFile("empty.beancount", "/journal?query=2024");
  c.workspace.ledgerSidebarMode.set("settings");
  expect(c.state.route.path).toBe("/import/accounts");
  expect(c.state.sidebar.settings).toBe(true);
  c.actions.navigate("/import/history");
  c.actions.returnFromSettings();
  expect(c.state.route.path).toBe("/journal");
  expect(c.state.route.query.query).toBe("2024");
  expect(c.state.activeFile).toBe("empty.beancount");
  expect(c.state.sidebar.settings).toBe(false);
  c.dispose();
});

it("initializes direct settings routes without redirecting away", async () => {
  const c = createBeancountController({
    source: createInMemorySource(),
    initialRoute: "/import/rules",
  });
  await c.initialize();
  expect(c.state.route.path).toBe("/import/rules");
  expect(c.state.sidebar.settings).toBe(true);
  c.actions.returnFromSettings();
  expect(c.state.route.path).toBe("/dashboard");
  c.dispose();
});

it("isolates sidebar modes, searches, expansion and tag history", async () => {
  const first = createBeancountController({ source: createInMemorySource() });
  const second = createBeancountController({ source: createInMemorySource() });
  await Promise.all([first.initialize(), second.initialize()]);
  first.actions.sidebar.setMode("search");
  first.actions.sidebar.setView("tags");
  first.actions.sidebar.setSearch("folders", "archive");
  first.actions.sidebar.setExpanded("folders", "archive", true);
  first.actions.selectTags(["#food"]);
  expect(get(first.presentation.query)).toContain("#food");
  expect(second.state.sidebar.mode).toBe("workspace");
  expect(second.state.sidebar.view).toBe("ledgers");
  expect(second.state.sidebar.searches.folders).toBe("");
  expect(second.state.sidebar.expanded.folders).toEqual({});
  expect(second.state.sidebar.selectedTags).toEqual([]);
  first.actions.back();
  expect(first.state.sidebar.selectedTags).toEqual([]);
  first.actions.forward();
  expect(first.state.sidebar.selectedTags).toEqual(["food"]);
  first.dispose();
  second.dispose();
});

it("opens projects in memory and keeps cancellation and errors local to the form", async () => {
  const c = createBeancountController({ source: createInMemorySource() });
  await c.initialize();
  expect(c.state.canAddProject).toBe(true);
  c.actions.sidebar.beginProjectOpen();
  await c.actions.addProject("cancel");
  expect(c.state.snapshot?.project.id).toBe("example");
  await c.actions.addProject("error");
  expect(c.state.snapshot?.project.id).toBe("example");
  expect(c.state.status).toBe("ready");
  expect(c.state.error).toBe("");
  expect(c.state.sidebar.projectError).toContain("could not be opened");
  await c.actions.addProject("Books");
  expect(c.state.snapshot?.project.name).toBe("Books");
  expect(c.state.sidebar.projectError).toBe("");
  expect(c.state.sidebar.projectFormOpen).toBe(false);
  c.actions.back();
  expect(c.state.snapshot?.project.id).toBe("example");
  c.dispose();
});

it("advertises unsupported project opening and aborts opening on disposal", async () => {
  const source = createInMemorySource();
  const unsupported = createBeancountController({
    source: { ...source, addProject: undefined },
  });
  expect(unsupported.state.canAddProject).toBe(false);
  unsupported.dispose();
  let signal: AbortSignal | undefined;
  const c = createBeancountController({
    source: {
      ...source,
      addProject(_path, nextSignal) {
        signal = nextSignal;
        return new Promise((_, reject) =>
          nextSignal?.addEventListener(
            "abort",
            () => reject(nextSignal.reason),
            { once: true },
          ),
        );
      },
    },
  });
  const pending = c.actions.addProject();
  c.dispose();
  await pending;
  expect(signal?.aborted).toBe(true);
});

it("replaces query initialization state without trapping Back on the query route", async () => {
  const c = createBeancountController({ source: createInMemorySource() });
  await c.initialize();
  c.actions.navigate("/statistics");
  c.actions.navigate("/query?qs=SELECT%20account");
  c.navigation.history.updateState({
    params: { qs: "SELECT account", selected: "query-hash" },
  });
  c.actions.back();
  expect(c.state.route.path).toBe("/statistics");
  c.actions.forward();
  expect(c.state.route.path).toBe("/query");
  expect(c.state.route.query).toMatchObject({
    qs: "SELECT account",
    selected: "query-hash",
  });
  expect(c.state.activeFile).toBe("main.beancount");
  expect(c.state.snapshot?.project.id).toBe("example");
  c.dispose();
});

it("does not notify routes again when replacement state is unchanged", async () => {
  const c = createBeancountController({ source: createInMemorySource() });
  await c.initialize();
  c.actions.navigate("/import/manage-merchants");
  let notifications = 0;
  const unsubscribe = c.navigation.activeRoute.subscribe(() => notifications++);
  c.navigation.router.updateState("?merchantId=cafe");
  const updated = notifications;
  c.navigation.router.updateState("?merchantId=cafe");
  expect(notifications).toBe(updated);
  unsubscribe();
  c.dispose();
});
