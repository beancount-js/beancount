/**
 * Produces the Accordion state for saved queries while retaining closed
 * entries.
 *
 * Keeping closed entries makes it possible to apply the dimmed history styling
 * after a query is collapsed.
 */
export function nextOpenQueryState(
  previous: Record<string, boolean>,
  values: readonly string[] | undefined,
): Record<string, boolean> {
  const openValues = new Set(values ?? []);
  const queryHashes = new Set([...Object.keys(previous), ...openValues]);

  return Object.fromEntries(
    [...queryHashes].map((hash) => [hash, openValues.has(hash)]),
  );
}
