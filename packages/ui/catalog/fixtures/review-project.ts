import main from "./review/main.beancount?raw";
import archive from "./review/archive/2023.beancount?raw";
import holdings from "./review/investments/holdings.beancount?raw";
import { demoProject, NOW } from "./project";

/** Files available to the catalog's synthetic review project. */
export function reviewProject() {
  const project = demoProject("review", main);
  project.project.name = "Review Project";
  project.ledgerFiles.push(
    { path: "archive/2023.beancount", contents: archive },
    { path: "investments/holdings.beancount", contents: holdings },
  );
  project.revisions = project.ledgerFiles.map(({ path }) => ({
    path,
    revision: "1",
    updatedAt: NOW,
  }));
  return project;
}
