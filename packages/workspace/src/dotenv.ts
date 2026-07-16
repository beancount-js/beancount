const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parse a dotenv file body into key → value (unquoted). */
export function parseDotenvEntries(
  contents: string,
): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trim();
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!ENV_KEY.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

/** Sorted unique env key names from a dotenv file body. */
export function parseDotenvKeys(contents: string): string[] {
  return Object.keys(parseDotenvEntries(contents)).sort((a, b) =>
    a.localeCompare(b),
  );
}
