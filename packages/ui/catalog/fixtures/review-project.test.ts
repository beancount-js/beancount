import { createBeancountController } from "../../src/controller/beancount-controller.svelte";
import { createInMemorySource } from "../controller/in-memory-source";
import { runBql } from "@beancount-js/beanquery";
import { expect, it } from "vitest";
import { LedgerSource } from "../../src/domain/core/ledger";
import { previewProject } from "./preview-project";
import sample from "./ledger/sample.beancount?raw";
import { reviewProject } from "./review-project";

it("loads each shared review ledger without errors and retains pagination data", () => {
  const project = reviewProject();
  for (const file of project.ledgerFiles) {
    const ledger = LedgerSource.fromProject(file.path, project.ledgerFiles);
    expect(ledger.errors.map((error) => error.message)).toEqual([]);
    expect(
      ledger.transactions.every(
        (transaction) => transaction.postings.length >= 2,
      ),
    ).toBe(true);
    if (file.path === "main.beancount")
      expect(ledger.transactions).toHaveLength(73);
  }
  expect(reviewProject()).not.toBe(project);
});

it("keeps the complete review ledger available to reports and query pagination", async () => {
  const controller = createBeancountController({
    source: createInMemorySource([reviewProject()]),
  });
  await controller.initialize();
  expect(controller.state.ledger.transactions).toHaveLength(73);
  const result = runBql(
    controller.state.ledger.directives,
    "SELECT date, narration, account, number, meta('note') AS note",
  );
  expect(result.error).toBeUndefined();
  expect(result.data.length).toBeGreaterThan(100);
  controller.dispose();
});

it("matches the preview workspace paths and loads the selected sample ledger", async () => {
  const project = previewProject();
  expect(project.ledgerFiles).toHaveLength(5);
  expect(project.project.entryFile).toBe("sample.beancount");
  expect(
    project.ledgerFiles.find((file) => file.path === project.project.entryFile)
      ?.contents,
  ).toBe(sample);
  const controller = createBeancountController({
    source: createInMemorySource([project]),
  });
  await controller.initialize();
  expect(controller.state.activeFile).toBe(project.project.entryFile);
  expect(controller.state.ledger.transactions.length).toBeGreaterThan(0);
  expect(controller.state.ledger.errors).toEqual([]);
  controller.dispose();
});
