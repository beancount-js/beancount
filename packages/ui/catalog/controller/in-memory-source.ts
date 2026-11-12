import { createApplicationServices } from "./application-services";
import type { BeancountDataSource } from "../../src/controller/contracts";
import type { ProjectSnapshot } from "@beancount-js/workspace";
import { demoProject, NOW } from "../fixtures/project";
export function createInMemorySource(
  seeds: ProjectSnapshot[] = [demoProject(), demoProject("second")],
): BeancountDataSource {
  const projects = new Map(
    seeds.map((project) => [project.project.id, structuredClone(project)]),
  );
  function read(id: string) {
    const project = projects.get(id);
    if (!project) throw new Error("Project not found.");
    return project;
  }
  async function saveFile(
    id: string,
    path: string,
    contents: string,
    expectedRevision?: string,
  ) {
    const project = read(id);
    const revision = project.revisions.find((file) => file.path === path);
    if (
      expectedRevision !== undefined &&
      expectedRevision !== revision?.revision
    )
      throw new Error("File changed since it was read.");
    const file = project.ledgerFiles.find((file) => file.path === path);
    if (!file) throw new Error("File not found.");
    file.contents = contents;
    if (revision) revision.revision = String(Number(revision.revision) + 1);
    project.project.updatedAt = NOW;
    return structuredClone(project);
  }
  const services = createApplicationServices(read, saveFile);
  let opened = 0;
  return {
    async addProject(path) {
      if (path === "cancel") return null;
      if (path === "error") throw new Error("The project could not be opened.");
      const project = demoProject(`opened-${++opened}`);
      project.project.name = path || "Opened Project";
      projects.set(project.project.id, project);
      return structuredClone(project);
    },
    request: services.request,
    async resourceUrl(id, path) {
      read(id);
      if (path !== "receipts/example.txt")
        throw new Error("Resource not found.");
      const text = "Example receipt\nGroceries: 120.00 GBP";
      return {
        url: "data:text/plain," + encodeURIComponent(text),
        mimeType: "text/plain",
        text,
      };
    },
    async listProjects() {
      return [...projects.values()].map(({ project }) =>
        structuredClone(project),
      );
    },
    async loadProject(id) {
      return structuredClone(read(id));
    },
    saveFile,
  };
}
