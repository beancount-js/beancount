import { afterEach, describe, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FilesystemWorkspaceAdapter } from "@beancount-js/server";
import { createWorkspaceBeancountDataSource } from "./data-source";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("filesystem application host", () => {
  test("loads and persists a real ledger through BeancountDataSource", async () => {
    const root = await mkdtemp(join(tmpdir(), "beancount-app-project-"));
    const configDirectory = await mkdtemp(
      join(tmpdir(), "beancount-app-config-"),
    );
    temporaryDirectories.push(root, configDirectory);
    await mkdir(join(root, "documents"));
    await writeFile(
      join(root, "main.beancount"),
      '2026-01-01 open Assets:Cash\n2026-01-02 document Assets:Cash "documents/receipt.txt"\n',
    );
    await writeFile(join(root, "documents/receipt.txt"), "Example receipt\n");

    const workspace = new FilesystemWorkspaceAdapter({ configDirectory });
    const project = await workspace.openProject(root, "main.beancount");
    const source = createWorkspaceBeancountDataSource(workspace);
    const initial = await source.loadProject(project.id);
    const revision = initial.revisions.find(
      (item) => item.path === "main.beancount",
    )?.revision;

    expect(initial.resources).toEqual([
      expect.objectContaining({
        path: "documents/receipt.txt",
        mimeType: "text/plain; charset=utf-8",
      }),
    ]);

    const contents =
      initial.ledgerFiles[0]!.contents + "2026-01-03 open Expenses:Food\n";
    const saved = await source.saveFile(
      project.id,
      "main.beancount",
      contents,
      revision,
    );

    expect(saved.ledgerFiles[0]?.contents).toBe(contents);
    expect(await readFile(join(root, "main.beancount"), "utf8")).toBe(contents);
    expect(saved.revisions[0]?.revision).not.toBe(revision);
  });
});
