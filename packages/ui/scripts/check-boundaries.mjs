import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ["src", ".storybook"];
const sourceExtensions = new Set([".css", ".js", ".mjs", ".svelte", ".ts"]);
const rootFiles = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
];

const forbiddenReferences = [
  /packages\/fava\b/,
  /(?:\.\.\/)+fava(?:\/|["'])/,
  /@beancount-js\/fava\b/,
  /packages\/forms\b/,
  /@beancount-js\/forms\b/,
  /\$lib(?:\/|["'])/,
  /\$app\/(?:navigation|stores)\b/,
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesIn(path)));
    } else if (
      sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))
    ) {
      files.push(path);
    }
  }
  return files;
}

const files = [
  ...(
    await Promise.all(
      sourceRoots.map((root) => filesIn(join(packageRoot, root))),
    )
  ).flat(),
  ...rootFiles.map((file) => join(packageRoot, file)),
];
const violations = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  content.split("\n").forEach((line, index) => {
    if (forbiddenReferences.some((expression) => expression.test(line))) {
      violations.push(
        `${relative(packageRoot, file)}:${index + 1}: ${line.trim()}`,
      );
    }
  });
}

if (violations.length) {
  console.error(
    "@lapis/ui must not resolve Fava/forms compatibility source or SvelteKit application aliases:\n" +
      violations.join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log("UI package boundary check passed.");
}
