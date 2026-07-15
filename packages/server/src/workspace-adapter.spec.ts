import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, test } from "vitest";
import { isUuidProjectId } from "@beancount-js/workspace";
import { FilesystemWorkspaceAdapter } from "./workspace-adapter";

describe("FilesystemWorkspaceAdapter", () => {
  test("registers a folder and exposes only ledger sources and declared resources", async () => {
    const root = await mkdtemp(join(tmpdir(), "beancount-studio-project-"));
    const config = await mkdtemp(join(tmpdir(), "beancount-studio-config-"));
    await mkdir(join(root, "accounts"));
    await writeFile(
      join(root, "main.beancount"),
      'include "accounts/cash.beancount"\n',
    );
    await writeFile(
      join(root, "accounts", "cash.beancount"),
      '2024-01-01 open Assets:Cash\n2024-01-02 document Assets:Cash "../receipt.pdf"\n',
    );
    await writeFile(join(root, "receipt.pdf"), "pdf");
    const adapter = new FilesystemWorkspaceAdapter({ configDirectory: config });

    const project = await adapter.openProject(root);
    expect(project.entryFile).toBe("main.beancount");
    expect(await adapter.listProjects()).toEqual([
      expect.objectContaining({ id: project.id, name: basename(root) }),
    ]);

    const snapshot = await adapter.readProject(project.id);
    expect(snapshot.ledgerFiles.map((file) => file.path)).toEqual([
      "accounts/cash.beancount",
      "main.beancount",
    ]);
    expect(snapshot.resources.map((file) => file.path)).toEqual([
      "receipt.pdf",
    ]);
    expect(await adapter.listResources(project.id)).toEqual([
      expect.objectContaining({
        path: "receipt.pdf",
        mimeType: "application/pdf",
        size: 3,
      }),
    ]);

    await adapter.writeFile(project.id, {
      path: "accounts/cash.beancount",
      contents: "2024-01-01 open Assets:Cash\n",
    });
    expect(
      await readFile(join(root, "accounts", "cash.beancount"), "utf8"),
    ).toContain("Assets:Cash");
    await expect(
      readFile(join(root, ".beancount", "project.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(adapter.readFile(project.id, "receipt.pdf")).rejects.toThrow(
      "Ledger file not found",
    );
    await expect(
      adapter.readResource(project.id, "accounts/cash.beancount"),
    ).rejects.toThrow("Resource not found");
  });

  test("does not allow a caller to read outside a project", async () => {
    const root = await mkdtemp(join(tmpdir(), "beancount-studio-project-"));
    const config = await mkdtemp(join(tmpdir(), "beancount-studio-config-"));
    await writeFile(join(root, "main.bean"), "2024-01-01 open Assets:Cash\n");
    const adapter = new FilesystemWorkspaceAdapter({ configDirectory: config });
    const project = await adapter.openProject(root);

    await expect(adapter.readFile(project.id, "../secret.txt")).rejects.toThrow(
      "Project file path escapes its root",
    );
  });

  test("rejects a write when the ledger revision has changed", async () => {
    const root = await mkdtemp(join(tmpdir(), "beancount-studio-project-"));
    const config = await mkdtemp(join(tmpdir(), "beancount-studio-config-"));
    const file = join(root, "main.bean");
    await writeFile(file, "2024-01-01 open Assets:Cash\n");
    const adapter = new FilesystemWorkspaceAdapter({ configDirectory: config });
    const project = await adapter.openProject(root);
    const snapshot = await adapter.readProject(project.id);
    const expectedRevision = snapshot.revisions.find(
      (item) => item.path === "main.bean",
    )!.revision;
    await writeFile(
      file,
      "2024-01-01 open Assets:Cash\n2024-01-02 open Expenses:Food\n",
    );

    await expect(
      adapter.writeFile(
        project.id,
        { path: "main.bean", contents: "2024-01-01 open Assets:Cash\n" },
        { expectedRevision },
      ),
    ).rejects.toThrow("File changed since it was read");
  });

  test("assigns slug ids from the folder name and reuses them by root", async () => {
    const root = await mkdtemp(join(tmpdir(), "bean-budget-"));
    const config = await mkdtemp(join(tmpdir(), "beancount-studio-config-"));
    await writeFile(join(root, "main.bean"), "2024-01-01 open Assets:Cash\n");
    const adapter = new FilesystemWorkspaceAdapter({ configDirectory: config });

    const first = await adapter.openProject(root);
    expect(first.id).toMatch(/^bean-budget-/);
    expect(isUuidProjectId(first.id)).toBe(false);

    const second = await adapter.openProject(root);
    expect(second.id).toBe(first.id);

    const registry = JSON.parse(
      await readFile(join(config, "projects.json"), "utf8"),
    ) as {
      version: number;
      rootPathToId: Record<string, string>;
    };
    expect(registry.version).toBe(2);
    expect(registry.rootPathToId[first.root!]).toBe(first.id);
  });

  test("suffixes slug ids when two roots share a folder name", async () => {
    const parent = await mkdtemp(join(tmpdir(), "beancount-dup-"));
    const config = await mkdtemp(join(tmpdir(), "beancount-studio-config-"));
    const rootA = join(parent, "a", "ledger");
    const rootB = join(parent, "b", "ledger");
    await mkdir(rootA, { recursive: true });
    await mkdir(rootB, { recursive: true });
    await writeFile(join(rootA, "main.bean"), "2024-01-01 open Assets:Cash\n");
    await writeFile(join(rootB, "main.bean"), "2024-01-01 open Assets:Bank\n");
    const adapter = new FilesystemWorkspaceAdapter({ configDirectory: config });

    const projectA = await adapter.openProject(rootA);
    const projectB = await adapter.openProject(rootB);
    expect(projectA.id).toBe("ledger");
    expect(projectB.id).toMatch(/^ledger-[a-z0-9]{4}$/);
    expect(projectB.id).not.toBe(projectA.id);
  });

  test("migrates UUID registry entries to slug ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "migrate-me-"));
    const config = await mkdtemp(join(tmpdir(), "beancount-studio-config-"));
    await writeFile(join(root, "main.bean"), "2024-01-01 open Assets:Cash\n");
    const uuid = "c755f7de-cb13-45ec-aad2-f9ed8995f8b0";
    await writeFile(
      join(config, "projects.json"),
      JSON.stringify({
        version: 1,
        projects: [
          {
            version: 1,
            id: uuid,
            name: basename(root),
            entryFile: "main.bean",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
            root,
          },
        ],
      }),
    );
    const adapter = new FilesystemWorkspaceAdapter({ configDirectory: config });
    const projects = await adapter.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]!.id).toMatch(/^migrate-me-/);
    expect(isUuidProjectId(projects[0]!.id)).toBe(false);
    await expect(adapter.readProject(projects[0]!.id)).resolves.toMatchObject({
      project: { id: projects[0]!.id },
    });
  });
});
