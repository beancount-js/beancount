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
