import minimal from "./ledger/minimal.beancount?raw";
import sample from "./ledger/catalog-sample.beancount?raw";
import offByOne from "./ledger/off-by-one.beancount?raw";
import budgets from "./ledger/sample-budgets.beancount?raw";
import rootSample from "./ledger/sample.beancount?raw";
import { demoProject, NOW } from "./project";

/** Static ledgers owned by the active catalog. */
export function previewProject() {
  const project = demoProject("catalog-preview");
  project.project.name = "beancount-studio-catalog-preview";
  project.project.entryFile = "sample.beancount";
  project.ledgerFiles = [
    { path: "sample.beancount", contents: rootSample },
    { path: "fixtures/ledger/minimal.beancount", contents: minimal },
    { path: "fixtures/ledger/catalog-sample.beancount", contents: sample },
    {
      path: "fixtures/ledger/off-by-one.beancount",
      contents: offByOne,
    },
    { path: "sample-budgets.beancount", contents: budgets },
  ];
  project.revisions = project.ledgerFiles.map(({ path }) => ({
    path,
    revision: "1",
    updatedAt: NOW,
  }));
  project.resources = [];
  return project;
}
