import { describe, expect, test, vi } from "vitest";
import type {
  ProjectConfig,
  ProjectSnapshot,
  WorkspaceAdapter,
} from "@beancount-js/workspace";
import {
  createHttpBeancountDataSource,
  createWorkspaceBeancountDataSource,
} from "./data-source";

const project: ProjectConfig = {
  version: 1,
  id: "example",
  name: "Example",
  entryFile: "main.beancount",
  createdAt: "2026-11-11T00:00:00.000Z",
  updatedAt: "2026-11-11T00:00:00.000Z",
};

function snapshot(contents = "2026-01-01 open Assets:Cash\n"): ProjectSnapshot {
  return {
    project,
    ledgerFiles: [{ path: project.entryFile, contents }],
    resources: [],
    revisions: [
      {
        path: project.entryFile,
        revision: "revision-1",
        updatedAt: project.updatedAt,
      },
    ],
    issues: [],
    envKeys: [],
  };
}

describe("createWorkspaceBeancountDataSource", () => {
  test("adapts durable workspace reads and revision-aware writes", async () => {
    let current = snapshot();
    const writeFile = vi.fn<WorkspaceAdapter["writeFile"]>(
      async (_projectId, file) => {
        current = snapshot(file.contents);
        return {
          path: file.path,
          revision: "revision-2",
          updatedAt: project.updatedAt,
        };
      },
    );
    const workspace = {
      listProjects: async () => [project],
      readProject: async () => current,
      writeFile,
    } as unknown as WorkspaceAdapter;
    const source = createWorkspaceBeancountDataSource(workspace);

    expect(await source.listProjects()).toEqual([project]);
    const next = await source.saveFile(
      project.id,
      project.entryFile,
      "2026-01-01 open Assets:Bank\n",
      "revision-1",
    );

    expect(writeFile).toHaveBeenCalledWith(
      project.id,
      {
        path: project.entryFile,
        contents: "2026-01-01 open Assets:Bank\n",
      },
      { expectedRevision: "revision-1" },
    );
    expect(next.ledgerFiles[0]?.contents).toContain("Assets:Bank");
  });
});

describe("createHttpBeancountDataSource", () => {
  test("uses the production project API and reloads after a save", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, init });
        if (url === "/api/projects") {
          return Response.json([project]);
        }
        if (init?.method === "PUT") {
          return Response.json({ revision: "revision-2" });
        }
        return Response.json(snapshot("2026-01-01 open Assets:Bank\n"));
      },
    );
    const source = createHttpBeancountDataSource(fetcher as typeof fetch);

    expect(await source.listProjects()).toEqual([project]);
    const next = await source.saveFile(
      project.id,
      project.entryFile,
      "2026-01-01 open Assets:Bank\n",
      "revision-1",
    );

    expect(requests.map(({ url }) => url)).toEqual([
      "/api/projects",
      "/api/projects/example/files/main.beancount",
      "/api/projects/example",
    ]);
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      contents: "2026-01-01 open Assets:Bank\n",
      expectedRevision: "revision-1",
    });
    expect(next.ledgerFiles[0]?.contents).toContain("Assets:Bank");
  });
});
