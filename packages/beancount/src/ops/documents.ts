import { DateTime } from "luxon";
import { isValidAccount } from "../core/account";
import { Document, sorted, type Directives } from "../core/data";
import { getAccounts } from "../core/getters";
import type { DocumentStore } from "../parser/loader";
import { ValidationError } from "./validation";

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function relativeToRoot(path: string, root: string): string | null {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(root);
  if (!normalizedRoot || normalizedRoot === ".") return normalizedPath;
  if (normalizedPath === normalizedRoot) return "";
  if (!normalizedPath.startsWith(`${normalizedRoot}/`)) return null;
  return normalizedPath.slice(normalizedRoot.length + 1);
}

function strictAccountError(
  account: string,
  accountsOnly: ReadonlySet<string>,
) {
  if (
    [...accountsOnly].some((candidate) => account.startsWith(`${candidate}:`))
  ) {
    return `Document found in child account ${account}`;
  }
  if (
    [...accountsOnly].some((candidate) => candidate.startsWith(`${account}:`))
  ) {
    return `Document found in parent account ${account}`;
  }
  return null;
}

/**
 * Finds dated document files from a bounded document store. The path below the
 * requested root maps directly to an account name, making this suitable for
 * browser project maps as well as server-side workspace adapters.
 */
export function findDocuments(
  store: DocumentStore,
  root: string,
  inputFilename: string,
  accountsOnly?: ReadonlySet<string>,
  strict = false,
): [Document[], ValidationError[]] {
  const entries: Document[] = [];
  const errors: ValidationError[] = [];
  for (const source of store.list(root)) {
    const relative = relativeToRoot(source.path, root);
    if (relative === null) continue;
    const parts = relative.split("/").filter(Boolean);
    const filename = parts.pop();
    if (!filename || parts.length === 0) continue;
    const match = /^(\d{4})-(\d{2})-(\d{2})\.(.+)$/.exec(filename);
    if (!match) continue;

    const account = parts.join(":");
    if (!isValidAccount(account)) continue;
    if (accountsOnly && !accountsOnly.has(account)) {
      const message = strict ? strictAccountError(account, accountsOnly) : null;
      if (message) {
        errors.push(
          new ValidationError(message, { filename: inputFilename, lineno: 0 }),
        );
      }
      continue;
    }

    const date = DateTime.fromObject({
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    });
    if (!date.isValid) {
      errors.push(
        new ValidationError(
          `Invalid date on document file "${filename}": ${date.invalidExplanation ?? "invalid date"}`,
          { filename: inputFilename, lineno: 0 },
        ),
      );
      continue;
    }
    entries.push(
      new Document(date, account, normalizePath(source.path), [], [], {
        filename: inputFilename,
        lineno: 0,
      }),
    );
  }
  return [sorted(entries) as Document[], errors];
}

/** Adds discovered documents for the given document roots to a ledger. */
export function processDocuments(
  entries: Directives,
  store: DocumentStore,
  roots: readonly string[],
  inputFilename: string,
): [Directives, ValidationError[]] {
  const accounts = getAccounts(entries);
  const generated: Document[] = [];
  const errors: ValidationError[] = [];
  for (const root of roots) {
    const [documents, documentErrors] = findDocuments(
      store,
      root,
      inputFilename,
      accounts,
    );
    generated.push(...documents);
    errors.push(...documentErrors);
  }
  return [sorted([...entries, ...generated]), errors];
}

/** Validates explicit document directives against the same bounded store. */
export function verifyDocumentFilesExist(
  entries: Directives,
  store: DocumentStore,
): [Directives, ValidationError[]] {
  const errors: ValidationError[] = [];
  for (const entry of entries) {
    if (entry instanceof Document && !store.exists(entry.filename)) {
      errors.push(
        new ValidationError(`File does not exist: "${entry.filename}"`, entry),
      );
    }
  }
  return [entries, errors];
}
