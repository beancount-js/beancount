/**
 * Obtain the parent account name.
 *
 * @param name - An account name.
 */
export function parent(name: string): string {
  name = name || "";
  const parentEnd = name.lastIndexOf(":");
  return parentEnd > 0 ? name.slice(0, parentEnd) : "";
}

/**
 * Obtain the leaf part of the account name, the last segment.
 *
 * @param name - An account name.
 */
export function leaf(name: string): string {
  name = name || "";
  const parentEnd = name.lastIndexOf(":");
  return parentEnd > 0 ? name.slice(parentEnd + 1) : name;
}
