import type { DirectiveBase } from "@beancount-js/beancount";

/** Stable key used for `?record=` journal editor deep links. */
export function journalRecordKey(directive: DirectiveBase): string {
  const source = directive.source;
  const filename = String(directive.meta["filename"] ?? "");
  if (source && filename) {
    return `${filename}:${source.position.from}:${source.position.to}`;
  }
  return directive.id;
}

export function findDirectiveByRecordKey(
  directives: readonly DirectiveBase[],
  key: string | undefined,
): DirectiveBase | undefined {
  if (!key) return undefined;
  return directives.find((directive) => journalRecordKey(directive) === key);
}
