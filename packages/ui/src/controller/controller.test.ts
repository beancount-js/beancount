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
  expect(await response.json()).toEqual([]);
  first.dispose();
  second.dispose();
  await expect(
    first.actions.request("/api/projects/example/ingestion"),
  ).rejects.toThrow("disposed");
});
