/**
 * Preserves open query panels while allowing user-driven fold state to close entries.
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
