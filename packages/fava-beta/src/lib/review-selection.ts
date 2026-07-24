export type CheckboxSelectionState = {
  checked: boolean;
  indeterminate: boolean;
  selectedCount: number;
};

/** Return the checkbox state for a selectable collection of row keys. */
export function checkboxSelectionState(
  selectedKeys: ReadonlySet<string>,
  rowKeys: readonly string[],
): CheckboxSelectionState {
  const selectedCount = rowKeys.filter((key) => selectedKeys.has(key)).length;
  const checked = rowKeys.length > 0 && selectedCount === rowKeys.length;
  return {
    checked,
    indeterminate: selectedCount > 0 && !checked,
    selectedCount,
  };
}

/** Select or clear a collection of row keys without mutating the input set. */
export function updateReviewSelection(
  selectedKeys: ReadonlySet<string>,
  rowKeys: readonly string[],
  selected: boolean,
) {
  const next = new Set(selectedKeys);
  for (const key of rowKeys) {
    if (selected) next.add(key);
    else next.delete(key);
  }
  return next;
}

/** Remove selection that is no longer present or actionable. */
export function pruneReviewSelection(
  selectedKeys: ReadonlySet<string>,
  validKeys: ReadonlySet<string>,
) {
  return new Set([...selectedKeys].filter((key) => validKeys.has(key)));
}
