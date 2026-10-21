import main from "./review/main.beancount?raw";
import archive from "./review/archive/2023.beancount?raw";
import holdings from "./review/investments/holdings.beancount?raw";
import { demoProject, NOW } from "./project";

/** These files are also selectable in the unchanged Fava reference application. */
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
