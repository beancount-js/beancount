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
  return {
    async listProjects() {
      return [...projects.values()].map(({ project }) =>
        structuredClone(project),
      );
    },
    async loadProject(id) {
      return structuredClone(read(id));
    },
    async saveFile(id, path, contents, expectedRevision) {
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
    },
  };
}
