import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
}
const failures = [];
for (const file of files("src")) {
  if (!/\.(ts|svelte|css)$/.test(file) || /\.(stories|test|spec)\./.test(file))
    continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /(?:from\s*|import\s*)["']([^"']+)["']/g,
  )) {
    if (
      /\$lib|\$app|catalog|@lapismd\/design-core\/(?:src|dist)/.test(match[1])
    )
      failures.push(`${file}: ${match[1]}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Production dependency boundaries passed.");
