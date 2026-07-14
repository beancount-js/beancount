import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, test } from "vitest";
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
    expect(snapshot.resources.map((file) => file.path)).toEqual(["receipt.pdf"]);
    expect(await adapter.listResources(project.id)).toEqual([
      expect.objectContaining({ path: "receipt.pdf", mimeType: "application/pdf", size: 3 }),
    ]);

    await adapter.writeFile(project.id, {
      path: "accounts/cash.beancount",
      contents: "2024-01-01 open Assets:Cash\n",
    });
    expect(
      await readFile(join(root, "accounts", "cash.beancount"), "utf8"),
    ).toContain("Assets:Cash");
    await expect(readFile(join(root, ".beancount-js", "project.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(adapter.readFile(project.id, "receipt.pdf")).rejects.toThrow(
      "Ledger file not found",
    );
    await expect(adapter.readResource(project.id, "accounts/cash.beancount")).rejects.toThrow(
      "Resource not found",
    );
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
});
