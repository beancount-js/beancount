import { randomUUID } from "node:crypto";
import { loadProjectSources } from "@beancount-js/beancount";
import type { ProjectSnapshot } from "@beancount-js/workspace";
import type { LedgerPatchProposal, LedgerReplacement } from "$lib/ai/chat";

export function applyLedgerReplacements(
  contents: string,
  replacements: LedgerReplacement[],
) {
  let next = contents;
  for (const replacement of replacements) {
    if (!replacement.oldText)
      throw new Error("Each proposed replacement needs non-empty oldText.");
    const first = next.indexOf(replacement.oldText);
    const last = next.lastIndexOf(replacement.oldText);
    if (first < 0)
      throw new Error("Proposed text no longer exists in the ledger file.");
    if (first !== last) {
      throw new Error(
        "Proposed text occurs more than once; use a unique, larger replacement block.",
      );
    }
    next = `${next.slice(0, first)}${replacement.newText}${next.slice(first + replacement.oldText.length)}`;
  }
  return next;
}

function validationMessages(
  snapshot: ProjectSnapshot,
  path: string,
  contents: string,
) {
  const files = snapshot.ledgerFiles.map((file) =>
    file.path === path
      ? { path: file.path, contents }
      : { path: file.path, contents: file.contents },
  );
  const [, errors] = loadProjectSources(snapshot.project.entryFile, files);
  return errors.map((error) => error.message);
}

export function introducedLedgerErrors(
  snapshot: ProjectSnapshot,
  path: string,
  contents: string,
) {
  const current = snapshot.ledgerFiles.find((file) => file.path === path);
  if (!current) throw new Error(`Ledger file not found: ${path}`);
  const known = new Set(validationMessages(snapshot, path, current.contents));
  return validationMessages(snapshot, path, contents).filter(
    (message) => !known.has(message),
  );
}

export function validateLedgerProposal(
  snapshot: ProjectSnapshot,
  proposal: Pick<LedgerPatchProposal, "file" | "replacements">,
) {
  const source = snapshot.ledgerFiles.find(
    (file) => file.path === proposal.file.path,
  );
  if (!source) throw new Error(`Ledger file not found: ${proposal.file.path}`);
  const contents = applyLedgerReplacements(
    source.contents,
    proposal.replacements,
  );
  const errors = introducedLedgerErrors(snapshot, source.path, contents);
  return { contents, errors };
}

export function ledgerProposal(
  snapshot: ProjectSnapshot,
  input: { path: string; title?: string; replacements: LedgerReplacement[] },
): LedgerPatchProposal {
  const source = snapshot.ledgerFiles.find((file) => file.path === input.path);
  const revision = snapshot.revisions.find(
    (item) => item.path === input.path,
  )?.revision;
  if (!source || !revision)
    throw new Error(`Ledger file not found: ${input.path}`);
  if (
    !Array.isArray(input.replacements) ||
    input.replacements.length === 0 ||
    input.replacements.length > 20
  ) {
    throw new Error("A proposal needs between one and twenty replacements.");
  }
  const replacements = input.replacements.map((replacement) => ({
    oldText: String(replacement.oldText ?? ""),
    newText: String(replacement.newText ?? ""),
  }));
  const title = input.title?.trim().slice(0, 160) || `Update ${input.path}`;
  let errors: string[] = [];
  try {
    const next = applyLedgerReplacements(source.contents, replacements);
    errors = introducedLedgerErrors(snapshot, input.path, next);
  } catch (error) {
    errors = [error instanceof Error ? error.message : String(error)];
  }
  return {
    id: randomUUID(),
    kind: "ledger",
    title,
    file: { path: input.path, revision },
    replacements,
    valid: errors.length === 0,
    ...(errors.length ? { errors } : {}),
  };
}
