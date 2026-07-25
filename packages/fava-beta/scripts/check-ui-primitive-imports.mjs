#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(packageRoot, "src");
const duplicateRoot = join(sourceRoot, "lib/components/ui");
const localPrimitiveImport = /\$lib\/components\/ui(?:\/|["'])/;

function collectSources(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path !== duplicateRoot) collectSources(path, output);
      continue;
    }
    if (entry.isFile() && /\.(svelte|ts)$/.test(entry.name)) output.push(path);
  }
  return output;
}

const sources = collectSources(sourceRoot);
const violations = [];

for (const path of sources) {
  const source = readFileSync(path, "utf8");
  source.split("\n").forEach((line, index) => {
    if (localPrimitiveImport.test(line)) {
      violations.push(
        `${relative(packageRoot, path)}:${index + 1}: ${line.trim()}`,
      );
    }
  });
}

if (violations.length > 0) {
  console.error(
    "Fava Beta runtime code must import primitives from @beancount-js/ui:",
  );
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(
  `Public UI primitive import check passed (${sources.length} files scanned).`,
);
