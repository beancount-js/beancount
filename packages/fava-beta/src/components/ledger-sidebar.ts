import type { ProjectFile } from "@beancount-js/workspace";
import { fuzzySearch } from "@beancount-js/filters";

export const LEDGER_ROOT_ID = "__ledger-root__";

export type LedgerFolderNode = {
  id: string;
  path: string;
  label: string;
  count: number;
  files: ProjectFile[];
  children: LedgerFolderNode[];
};

export type LedgerTagSummary = {
  tag: string;
  fileCount: number;
};

export type LedgerTagTreeNode = {
  name: string;
  tag: string;
  count: number;
  exactCount: number;
  summary: LedgerTagSummary | null;
  children: LedgerTagTreeNode[];
};

function normalizedPath(path: string) {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").trim();
}

function normalizedQuery(value: string) {
  return value.trim().toLowerCase();
}

export function ledgerFileName(path: string) {
  return normalizedPath(path).split("/").at(-1) || path;
}

/** Returns a ledger's display title, falling back to its filename. */
export function ledgerFileLabel(file: Pick<ProjectFile, "path" | "contents">) {
  const titleMatch = file.contents.match(
    /^\s*option\s+"title"\s+("(?:[^"\\]|\\.)*")\s*(?:;.*)?$/mu,
  );
  if (titleMatch?.[1]) {
    try {
      const title = JSON.parse(titleMatch[1]);
      if (typeof title === "string" && title.trim()) return title.trim();
    } catch {
      // Use the filename when the option value is not a valid quoted string.
    }
  }

  return ledgerFileName(file.path);
}

export function normalizeLedgerTag(tag: string) {
  return tag.trim().replace(/^#+/, "").replaceAll("\\", "/");
}

/** Reads Beancount tag tokens, including hierarchical tags such as #tax/2026. */
export function ledgerFileTags(file: Pick<ProjectFile, "contents">) {
  const tags = new Set<string>();
  const tagPattern = /(?:^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu;

  for (const match of file.contents.matchAll(tagPattern)) {
    const tag = normalizeLedgerTag(match[1] ?? "");
    if (tag) tags.add(tag);
  }

  return [...tags].sort((left, right) => left.localeCompare(right));
}

export function createLedgerTagSummaries(files: ProjectFile[]) {
  const filesByTag = new Map<string, Set<string>>();

  for (const file of files) {
    for (const tag of ledgerFileTags(file)) {
      const paths = filesByTag.get(tag) ?? new Set<string>();
      paths.add(file.path);
      filesByTag.set(tag, paths);
    }
  }

  return [...filesByTag.entries()]
    .map(([tag, paths]) => ({ tag, fileCount: paths.size }))
    .sort((left, right) => left.tag.localeCompare(right.tag));
}

export function filterLedgerTagsByPathMatch(
  tags: LedgerTagSummary[],
  query: string,
) {
  const needle = normalizeLedgerTag(query).toLowerCase();
  if (!needle) return tags;

  const pathMatches = tags.filter(({ tag }) => {
    const path = normalizeLedgerTag(tag).toLowerCase();
    return (
      path === needle ||
      path.startsWith(`${needle}/`) ||
      path.includes(`/${needle}/`) ||
      path.endsWith(`/${needle}`) ||
      path.includes(needle)
    );
  });
  if (pathMatches.length) return pathMatches;

  const fuzzyMatches = fuzzySearch(tags, needle, {
    keys: [{ name: "tag", weight: 3 }],
  });
  return fuzzyMatches;
}

export function createLedgerTagTree(tags: LedgerTagSummary[]) {
  const nodeByPath = new Map<string, LedgerTagTreeNode>();
  const roots: LedgerTagTreeNode[] = [];

  for (const summary of tags) {
    const parts = normalizeLedgerTag(summary.tag)
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) continue;

    let parent: LedgerTagTreeNode | undefined;
    for (let index = 0; index < parts.length; index += 1) {
      const tag = parts.slice(0, index + 1).join("/");
      let node = nodeByPath.get(tag);
      if (!node) {
        node = {
          name: parts[index]!,
          tag,
          count: 0,
          exactCount: 0,
          summary: null,
          children: [],
        };
        nodeByPath.set(tag, node);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      if (index === parts.length - 1) {
        node.summary = summary;
        node.exactCount = summary.fileCount;
      }
      parent = node;
    }
  }

  function finalize(node: LedgerTagTreeNode): number {
    const childCount = node.children.reduce(
      (total, child) => total + finalize(child),
      0,
    );
    node.count = node.summary ? node.exactCount : childCount;
    node.children.sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    );
    return node.count;
  }

  for (const node of roots) finalize(node);
  return roots.sort(
    (left, right) =>
      right.count - left.count || left.name.localeCompare(right.name),
  );
}

export function filterLedgerFiles(
  files: ProjectFile[],
  query: string,
  selectedTags: string[] = [],
) {
  const needle = normalizedQuery(query);
  const requiredTags = selectedTags
    .map((tag) => normalizeLedgerTag(tag).toLowerCase())
    .filter(Boolean);

  const taggedFiles = files.filter((file) => {
    if (!requiredTags.length) return true;
    const tags = ledgerFileTags(file).map((tag) => tag.toLowerCase());
    return requiredTags.every((filter) =>
      tags.some((tag) => tag === filter || tag.startsWith(`${filter}/`)),
    );
  });
  if (!needle) return taggedFiles;

  const documents = taggedFiles.map((file) => ({
    file,
    label: ledgerFileName(file.path),
    path: normalizedPath(file.path),
  }));
  const directMatches = documents.filter(({ label, path }) =>
    [label, path].some((value) => value.toLowerCase().includes(needle)),
  );
  if (directMatches.length) return directMatches.map((result) => result.file);

  return fuzzySearch(documents, needle, {
    keys: [
      { name: "label", weight: 3 },
      { name: "path", weight: 2 },
    ],
  }).map((result) => result.file);
}

function ensureChild(parent: LedgerFolderNode, path: string, label: string) {
  let child = parent.children.find((item) => item.path === path);
  if (!child) {
    child = {
      id: path,
      path,
      label,
      count: 0,
      files: [],
      children: [],
    };
    parent.children.push(child);
  }
  return child;
}

function finalizeFolder(node: LedgerFolderNode): LedgerFolderNode {
  node.files.sort((left, right) => left.path.localeCompare(right.path));
  node.children = node.children
    .map(finalizeFolder)
    .sort((left, right) => left.label.localeCompare(right.label));
  node.count =
    node.files.length +
    node.children.reduce((total, child) => total + child.count, 0);
  return node;
}

export function createLedgerFolderTree(files: ProjectFile[]) {
  const root: LedgerFolderNode = {
    id: LEDGER_ROOT_ID,
    path: "",
    label: "Ledgers",
    count: 0,
    files: [],
    children: [],
  };

  for (const file of files) {
    const segments = normalizedPath(file.path).split("/").filter(Boolean);
    const folders = segments.slice(0, -1);
    let current = root;
    for (let index = 0; index < folders.length; index += 1) {
      const path = folders.slice(0, index + 1).join("/");
      current = ensureChild(current, path, folders[index]!);
    }
    current.files.push(file);
  }

  return finalizeFolder(root);
}

function cloneFolder(node: LedgerFolderNode): LedgerFolderNode {
  return {
    ...node,
    files: [...node.files],
    children: node.children.map(cloneFolder),
  };
}

type FolderSearchDocument = {
  kind: "folder";
  path: string;
  label: string;
};

type FileSearchDocument = {
  kind: "file";
  path: string;
  label: string;
};

function collectFolderSearchDocuments(
  node: LedgerFolderNode,
): Array<FolderSearchDocument | FileSearchDocument> {
  const documents: Array<FolderSearchDocument | FileSearchDocument> = [
    { kind: "folder", path: node.path, label: node.label },
    ...node.files.map((file) => ({
      kind: "file" as const,
      path: normalizedPath(file.path),
      label: ledgerFileName(file.path),
    })),
  ];
  for (const child of node.children) {
    documents.push(...collectFolderSearchDocuments(child));
  }
  return documents;
}

function filterFolder(
  node: LedgerFolderNode,
  matchingFolders: ReadonlySet<string>,
  matchingFiles: ReadonlySet<string>,
): LedgerFolderNode | null {
  if (matchingFolders.has(node.path)) return finalizeFolder(cloneFolder(node));

  const files = node.files.filter((file) =>
    matchingFiles.has(normalizedPath(file.path)),
  );
  const children = node.children
    .map((child) => filterFolder(child, matchingFolders, matchingFiles))
    .filter((child): child is LedgerFolderNode => child !== null);
  if (!files.length && !children.length) return null;

  return finalizeFolder({ ...node, files, children });
}

export function filterLedgerFolderTree(tree: LedgerFolderNode, query: string) {
  const needle = normalizedQuery(query);
  if (!needle) return finalizeFolder(cloneFolder(tree));
  const documents = collectFolderSearchDocuments(tree);
  const directMatches = documents.filter(({ label, path }) =>
    [label, path].some((value) => value.toLowerCase().includes(needle)),
  );
  const matches = directMatches.length
    ? directMatches
    : fuzzySearch(documents, needle, {
        keys: [
          { name: "label", weight: 3 },
          { name: "path", weight: 2 },
        ],
      });
  const matchingFolders = new Set(
    matches
      .filter((match): match is FolderSearchDocument => match.kind === "folder")
      .map((match) => match.path),
  );
  const matchingFiles = new Set(
    matches
      .filter((match): match is FileSearchDocument => match.kind === "file")
      .map((match) => match.path),
  );
  return filterFolder(tree, matchingFolders, matchingFiles);
}

export function collectExpandableLedgerFolderIds(
  node: LedgerFolderNode,
): string[] {
  const ids: string[] = [];
  if (node.files.length || node.children.length) ids.push(node.id);
  for (const child of node.children) {
    ids.push(...collectExpandableLedgerFolderIds(child));
  }
  return ids;
}

export function ledgerFolderAncestorIds(path: string) {
  const folders = normalizedPath(path).split("/").filter(Boolean).slice(0, -1);
  return [
    LEDGER_ROOT_ID,
    ...folders.map((_, index) => folders.slice(0, index + 1).join("/")),
  ];
}
