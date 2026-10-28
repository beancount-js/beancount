import type { DirectiveBase } from "@beancount-js/beancount";

export type JournalRecordAnchor = {
  filename: string;
  content: string;
  from: number;
  to: number;
};

/** Stable key used for `?record=` journal editor deep links. */
export function journalRecordKey(directive: DirectiveBase): string {
  const anchor = journalRecordAnchor(directive);
  if (anchor) {
    return `${anchor.filename}:${anchor.from}:${anchor.to}`;
  }
  return directive.id;
}

/**
 * A content anchor survives edits elsewhere in the source file, unlike a
 * record key's byte offsets. It is intentionally kept in-memory only: route
 * links remain compact position keys and are refreshed after a successful
 * save.
 */
export function journalRecordAnchor(
  directive: DirectiveBase,
): JournalRecordAnchor | undefined {
  const source = directive.source;
  const filename = String(directive.meta["filename"] ?? "");
  if (!source || !filename) return undefined;
  return {
    filename,
    content: source.content,
    from: source.position.from,
    to: source.position.to,
  };
}

export function findDirectiveByRecordKey(
  directives: readonly DirectiveBase[],
  key: string | undefined,
): DirectiveBase | undefined {
  if (!key) return undefined;
  return directives.find((directive) => journalRecordKey(directive) === key);
}

/**
 * Re-locate an unchanged record after edits before it shift its byte range.
 * Exact duplicate records are resolved to the closest prior position.
 */
export function findDirectiveByRecordAnchor(
  directives: readonly DirectiveBase[],
  anchor: JournalRecordAnchor | undefined,
): DirectiveBase | undefined {
  if (!anchor) return undefined;
  return directives
    .filter((directive) => {
      const candidate = journalRecordAnchor(directive);
      return (
        candidate?.filename === anchor.filename &&
        candidate.content === anchor.content
      );
    })
    .sort((left, right) => {
      const leftFrom =
        journalRecordAnchor(left)?.from ?? Number.MAX_SAFE_INTEGER;
      const rightFrom =
        journalRecordAnchor(right)?.from ?? Number.MAX_SAFE_INTEGER;
      return (
        Math.abs(leftFrom - anchor.from) - Math.abs(rightFrom - anchor.from)
      );
    })[0];
}
