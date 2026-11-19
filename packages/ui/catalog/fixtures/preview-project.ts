import minimal from "./reference/minimal.beancount?raw";
import sample from "./reference/fava-sample.beancount?raw";
import offByOne from "./reference/off-by-one.beancount?raw";
import budgets from "./reference/sample-budgets.beancount?raw";
import rootSample from "./reference/sample.beancount?raw";
import { demoProject, NOW } from "./project";

/** Static ledger snapshots from the selected Fava reference commit, 792cd4c7. */
export function previewProject() {
  const project = demoProject("fava-query-table-reference");
  project.project.name = "beancount-js-studio-query-table-498bd075";
  project.project.entryFile = "sample.beancount";
  project.ledgerFiles = [
    { path: "sample.beancount", contents: rootSample },
    { path: "fixtures/reference/minimal.beancount", contents: minimal },
    { path: "fixtures/reference/fava-sample.beancount", contents: sample },
    {
      path: "fixtures/reference/off-by-one.beancount",
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
