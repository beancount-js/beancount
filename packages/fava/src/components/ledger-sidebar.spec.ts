import { describe, expect, it } from "vitest";
import type { ProjectFile } from "@beancount-js/workspace";
import {
  LEDGER_ROOT_ID,
  createLedgerFolderTree,
  createLedgerTagSummaries,
  createLedgerTagTree,
  filterLedgerFiles,
  filterLedgerFolderTree,
} from "./ledger-sidebar";

const files: ProjectFile[] = [
  {
    path: "main.beancount",
    contents: "2026-01-01 open Assets:Bank #household",
  },
  {
    path: "tax/2026/beancount.bean",
    contents: '2026-02-01 * "Tax return" #tax/2026 #household',
  },
  {
    path: "tax/2025/beancount.bean",
    contents: '2025-12-31 * "Prior return" #tax/2025',
  },
];

describe("ledger sidebar helpers", () => {
  it("groups ledger files into a path hierarchy", () => {
    const tree = createLedgerFolderTree(files);

    expect(tree).toMatchObject({
      id: LEDGER_ROOT_ID,
      label: "Ledgers",
      count: 3,
    });
    expect(tree.files.map((file) => file.path)).toEqual(["main.beancount"]);
    expect(tree.children[0]).toMatchObject({ path: "tax", count: 2 });
    expect(tree.children[0]?.children.map((child) => child.path)).toEqual([
      "tax/2025",
      "tax/2026",
    ]);
  });

  it("keeps matching files and their containing folders when filtering", () => {
    const filtered = filterLedgerFolderTree(
      createLedgerFolderTree(files),
      "2026",
    );

    expect(filtered?.count).toBe(1);
    expect(filtered?.children[0]?.path).toBe("tax");
    expect(filtered?.children[0]?.children[0]?.files[0]?.path).toBe(
      "tax/2026/beancount.bean",
    );
  });

  it("extracts hierarchical tags and applies all selected filters", () => {
    const tags = createLedgerTagSummaries(files);
    const tree = createLedgerTagTree(tags);

    expect(tags).toEqual([
      { tag: "household", fileCount: 2 },
      { tag: "tax/2025", fileCount: 1 },
      { tag: "tax/2026", fileCount: 1 },
    ]);
    expect(tree.find((node) => node.tag === "tax")).toMatchObject({
      count: 2,
      children: [{ tag: "tax/2025" }, { tag: "tax/2026" }],
    });
    expect(filterLedgerFiles(files, "", ["household", "tax/2026"])).toEqual([
      files[1],
    ]);
    expect(filterLedgerFiles(files, "", ["tax"])).toEqual([files[1], files[2]]);
  });
});
