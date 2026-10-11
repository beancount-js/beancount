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
    async request(url, init) {
      if (init?.signal?.aborted) throw init.signal.reason;
      const path = new URL(url, "http://fixture.invalid").pathname;
      if (path.endsWith("/merchants")) return Response.json([]);
      if (path.endsWith("/merchant-review"))
        return Response.json({ clusters: [] });
      if (path.endsWith("/ingestion"))
        return Response.json({
          version: 3,
          sources: [],
          accounts: ["Assets:Checking", "Expenses:Food"],
        });
      throw new Error(`Unsupported fixture service: ${path}`);
    },
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
