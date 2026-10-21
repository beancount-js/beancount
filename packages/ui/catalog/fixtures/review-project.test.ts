import { expect, it } from "vitest";
import { LedgerSource } from "../../src/domain/core/ledger";
import { reviewProject } from "./review-project";

it("loads each shared review ledger without errors and retains pagination data", () => {
  const project = reviewProject();
  for (const file of project.ledgerFiles) {
    const ledger = LedgerSource.fromProject(file.path, project.ledgerFiles);
    expect(ledger.errors.map((error) => error.message)).toEqual([]);
    if (file.path === "main.beancount")
      expect(ledger.transactions).toHaveLength(73);
  }
  expect(reviewProject()).not.toBe(project);
});
