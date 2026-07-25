export type UiTreeTableNode = {
  readonly account: string;
  readonly balance: Readonly<Record<string, number>>;
  readonly balanceChildren: Readonly<Record<string, number>>;
  readonly cost: Readonly<Record<string, number>>;
  readonly costChildren: Readonly<Record<string, number>>;
  readonly invert?: number;
  readonly children: readonly UiTreeTableNode[];
};

export function isEmptyRecord(values: Readonly<Record<string, number>>): boolean {
  return Object.keys(values).length === 0;
}

export function collectCollapsibleNodeIds(
  entries: readonly UiTreeTableNode[],
): string[] {
  return entries.flatMap((entry) =>
    entry.children.length
      ? [entry.account, ...collectCollapsibleNodeIds(entry.children)]
      : [],
  );
}

export function collectNodeAccountIds(
  entries: readonly UiTreeTableNode[],
): Set<string> {
  return new Set(collectCollapsibleNodeIds(entries));
}
