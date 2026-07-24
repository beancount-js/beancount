import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const violations = [];

if (manifest.dependencies?.["@beancount-js/ui"] !== "workspace:*") {
  violations.push(
    "package.json must depend on @beancount-js/ui via workspace:*",
  );
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await sourceFiles(path) : [path]));
  }
  return files;
}

const files = await sourceFiles(join(packageRoot, "src"));
for (const file of files) {
  if (extname(file) !== ".ts") {
    violations.push(
      `${relative(packageRoot, file)} duplicates implementation in the facade`,
    );
  }
}

const allowedFiles = new Set([
  join(packageRoot, "src/index.ts"),
  join(packageRoot, "src/core.ts"),
  join(packageRoot, "src/account-avatar.ts"),
  join(packageRoot, "src/appearance-color.ts"),
  ...Object.values(manifest.exports ?? {})
    .filter((target) => typeof target === "string")
    .map((target) => join(packageRoot, target)),
]);
for (const file of files) {
  if (!allowedFiles.has(file)) {
    violations.push(
      `${relative(packageRoot, file)} is not an approved compatibility forwarder`,
    );
  }
}

for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
  if (typeof target !== "string" || !target.startsWith("./src/")) {
    violations.push(`${subpath} must target a local facade module`);
    continue;
  }
  try {
    await access(join(packageRoot, target));
  } catch {
    violations.push(`${subpath} targets missing ${target}`);
  }
}

const rootFacade = await readFile(join(packageRoot, "src/index.ts"), "utf8");
if (rootFacade.trim() !== 'export * from "@beancount-js/ui/forms";') {
  violations.push("src/index.ts must only re-export @beancount-js/ui/forms");
}

const coreFacade = await readFile(join(packageRoot, "src/core.ts"), "utf8");
if (coreFacade.trim() !== 'export * from "@beancount-js/ui/forms/core";') {
  violations.push(
    "src/core.ts must only re-export @beancount-js/ui/forms/core",
  );
}

const helperFacades = new Map([
  [
    "account-avatar.ts",
    `export {
  accountAvatarFallbackColor,
  accountAvatarInitial,
} from "@beancount-js/ui/forms/helpers/account-avatar";`,
  ],
  [
    "appearance-color.ts",
    `export {
  appearanceIconContrast,
  appearanceIconForeground,
  appearanceIconTint,
  autoCorrectAppearanceColor,
  isAppearanceColor,
  MINIMUM_APPEARANCE_CONTRAST,
  needsAppearanceContrastCorrection,
  normalizeAppearanceColor,
} from "@beancount-js/ui/forms/helpers/appearance-color";`,
  ],
]);
for (const [helper, expected] of helperFacades) {
  const content = await readFile(join(packageRoot, "src", helper), "utf8");
  if (content.trim() !== expected) {
    violations.push(`src/${helper} must only forward UI form helpers`);
  }
}

for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
  if (!subpath.startsWith("./components/") || typeof target !== "string") {
    continue;
  }
  const component = subpath.slice("./components/".length, -".svelte".length);
  const expected =
    `export { default } from ` +
    `"@beancount-js/ui/forms/${component}.svelte";`;
  const content = await readFile(join(packageRoot, target), "utf8");
  if (content.trim() !== expected) {
    violations.push(`${target} must only forward ${subpath}`);
  }
}

if (violations.length) {
  console.error(
    "@beancount-js/forms compatibility facade check failed:\n" +
      violations.map((violation) => `- ${violation}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Forms compatibility facade passed (${files.length} TypeScript forwarders).`,
  );
}
