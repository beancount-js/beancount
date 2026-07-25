import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const finalAudit = process.argv.includes("--final");

const errors = [];

function fail(message) {
  errors.push(message);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function changedFiles() {
  try {
    return execFileSync("jj", ["--no-pager", "diff", "--name-only"], {
      cwd: repoRoot,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    fail(
      `Unable to inspect jj diff for immutable Fava edits: ${error.message}`,
    );
    return [];
  }
}

function walkFiles(root, predicate) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const entryPath = path.join(root, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === ".svelte-kit") continue;
      files.push(...walkFiles(entryPath, predicate));
    } else if (stats.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files;
}

const immutableFavaChanges = changedFiles().filter((file) =>
  file.startsWith("packages/fava/"),
);

if (immutableFavaChanges.length > 0) {
  fail(
    [
      "Immutable Fava reference has working-copy changes:",
      ...immutableFavaChanges.map((file) => `  - ${file}`),
    ].join("\n"),
  );
}

if (finalAudit) {
  const migrationTrackerPath = path.join(
    repoRoot,
    "packages/ui/FAVA_MIGRATION.md",
  );
  const migrationTracker = readFileSync(migrationTrackerPath, "utf8");
  const componentRows = [
    ...migrationTracker.matchAll(
      /^\|\s*(C\d{3})\s*\|[^|]*\|\s*([^|]+?)\s*\|/gm,
    ),
  ].map((match) => ({
    id: match[1],
    status: match[2].trim(),
  }));

  const expectedComponentIds = new Set(
    Array.from(
      { length: 70 },
      (_, index) => `C${String(index + 1).padStart(3, "0")}`,
    ),
  );
  const seenComponentIds = new Set(componentRows.map((row) => row.id));
  const missingComponentIds = [...expectedComponentIds].filter(
    (id) => !seenComponentIds.has(id),
  );
  const incompleteComponentRows = componentRows.filter(
    (row) => expectedComponentIds.has(row.id) && row.status !== "Done",
  );

  if (missingComponentIds.length > 0) {
    fail(
      [
        "Migration tracker is missing component rows:",
        ...missingComponentIds.map((id) => `  - ${id}`),
      ].join("\n"),
    );
  }

  if (incompleteComponentRows.length > 0) {
    fail(
      [
        "Migration tracker has incomplete component rows:",
        ...incompleteComponentRows.map(
          (row) => `  - ${row.id}: ${row.status}`,
        ),
      ].join("\n"),
    );
  }
}

const codeExtensions = new Set([
  ".js",
  ".mjs",
  ".svelte",
  ".ts",
  ".tsx",
]);

const legacyFormsImportPattern =
  /\bfrom\s+["']@beancount-js\/forms(?:\/[^"']*)?["']|\bimport\s+["']@beancount-js\/forms(?:\/[^"']*)?["']|\bimport\s*\(\s*["']@beancount-js\/forms(?:\/[^"']*)?["']/;
const legacyFormsMetadataPattern =
  /["']@beancount-js\/forms(?:\/[^"']*)?["']/;
const uiImportPattern =
  /(?:\bfrom\s+["']|\bimport\s+["']|\bimport\s*\(\s*["'])(@beancount-js\/ui(?:\/[^"']*)?)["']/g;

const scanRoots = [
  path.join(repoRoot, "packages/fava-beta/src"),
  path.join(repoRoot, "packages/ui/src"),
];

const metadataFiles = [
  path.join(repoRoot, "packages/fava-beta/package.json"),
  path.join(repoRoot, "packages/fava-beta/vite.config.ts"),
];

const codeFiles = scanRoots.flatMap((root) =>
  walkFiles(root, (filePath) => codeExtensions.has(path.extname(filePath))),
);

const legacyFormsHits = codeFiles.filter((filePath) =>
  legacyFormsImportPattern.test(readFileSync(filePath, "utf8")),
);

const legacyFormsMetadataHits = metadataFiles.filter((filePath) =>
  legacyFormsMetadataPattern.test(readFileSync(filePath, "utf8")),
);

const lockfile = readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");
const favaBetaImporter =
  /(?:^|\n)  packages\/fava-beta:\n([\s\S]*?)(?=\n  \S|$)/.exec(lockfile)?.[1] ??
  "";
const legacyFormsLockfileHit =
  /['"]@beancount-js\/forms['"]\s*:/.test(favaBetaImporter);

if (
  legacyFormsHits.length > 0 ||
  legacyFormsMetadataHits.length > 0 ||
  legacyFormsLockfileHit
) {
  fail(
    [
      "Mutable UI/Beta source or metadata imports the legacy forms facade:",
      ...legacyFormsHits.map((filePath) => `  - ${relative(filePath)}`),
      ...legacyFormsMetadataHits.map((filePath) => `  - ${relative(filePath)}`),
      ...(legacyFormsLockfileHit
        ? ["  - pnpm-lock.yaml: packages/fava-beta importer"]
        : []),
    ].join("\n"),
  );
}

const rootPackageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const uiPackageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "packages/ui/package.json"), "utf8"),
);
const uiExportKeys = Object.keys(uiPackageJson.exports ?? {});

function missingScripts(packageJson, scripts) {
  return scripts.filter((script) => !packageJson.scripts?.[script]);
}

const missingRootScripts = missingScripts(rootPackageJson, [
  "audit:fava-migration",
  "audit:fava-migration:final",
  "report:fava-migration",
  "report:fava-migration:json",
  "test:c006",
  "test:ui:c006",
  "test:e2e:beta:c006",
  "validate:fava-migration:preflight",
  "validate:fava-migration",
]);
const missingUiScripts = missingScripts(uiPackageJson, [
  "audit:fava-migration",
  "audit:fava-migration:final",
  "report:fava-migration",
  "report:fava-migration:json",
  "test-visual:c006",
]);
const expectedUiImplementations = {
  "audit:fava-migration": "node ./scripts/audit-fava-migration.mjs",
  "audit:fava-migration:final":
    "node ./scripts/audit-fava-migration.mjs --final",
  "report:fava-migration": "node ./scripts/report-fava-migration.mjs",
  "report:fava-migration:json":
    "node ./scripts/report-fava-migration.mjs --json",
};
const mismatchedUiImplementations = Object.entries(
  expectedUiImplementations,
).filter(([script, command]) => uiPackageJson.scripts?.[script] !== command);
const expectedRootDelegates = {
  "audit:fava-migration":
    "pnpm --filter @lapis/ui audit:fava-migration",
  "audit:fava-migration:final":
    "pnpm --filter @lapis/ui audit:fava-migration:final",
  "report:fava-migration":
    "pnpm --filter @lapis/ui report:fava-migration",
  "report:fava-migration:json":
    "pnpm --filter @lapis/ui report:fava-migration:json",
};
const mismatchedRootDelegates = Object.entries(expectedRootDelegates).filter(
  ([script, command]) => rootPackageJson.scripts?.[script] !== command,
);
const expectedRootValidationScripts = {
  "validate:fava-migration:preflight":
    "pnpm audit:fava-migration && pnpm test:c006 && pnpm checks:ui && pnpm checks:beta",
  "validate:fava-migration":
    "pnpm audit:fava-migration:final && pnpm test:c006 && pnpm checks:ui && pnpm checks:beta",
};
const mismatchedRootValidationScripts = Object.entries(
  expectedRootValidationScripts,
).filter(([script, command]) => rootPackageJson.scripts?.[script] !== command);

if (
  missingRootScripts.length > 0 ||
  missingUiScripts.length > 0 ||
  mismatchedUiImplementations.length > 0 ||
  mismatchedRootDelegates.length > 0 ||
  mismatchedRootValidationScripts.length > 0
) {
  fail(
    [
      "Migration command surface is incomplete:",
      ...missingRootScripts.map((script) => `  - root package.json: ${script}`),
      ...missingUiScripts.map(
        (script) => `  - packages/ui/package.json: ${script}`,
      ),
      ...mismatchedUiImplementations.map(
        ([script, command]) =>
          `  - packages/ui/package.json implementation ${script} must be ${command}`,
      ),
      ...mismatchedRootDelegates.map(
        ([script, command]) =>
          `  - root package.json delegate ${script} must be ${command}`,
      ),
      ...mismatchedRootValidationScripts.map(
        ([script, command]) =>
          `  - root package.json validation ${script} must be ${command}`,
      ),
    ].join("\n"),
  );
}

function uiExportSubpath(specifier) {
  const suffix = specifier.slice("@lapis/ui".length);
  return suffix ? `.${suffix}` : ".";
}

function exportKeyMatches(exportKey, subpath) {
  if (!exportKey.includes("*")) return exportKey === subpath;
  const [prefix, suffix] = exportKey.split("*");
  return subpath.startsWith(prefix) && subpath.endsWith(suffix);
}

const uiImportHits = [];
for (const filePath of codeFiles.filter((filePath) =>
  relative(filePath).startsWith("packages/fava-beta/src/"),
)) {
  const source = readFileSync(filePath, "utf8");
  for (const match of source.matchAll(uiImportPattern)) {
    const specifier = match[1];
    const subpath = uiExportSubpath(specifier);
    const exported = uiExportKeys.some((exportKey) =>
      exportKeyMatches(exportKey, subpath),
    );
    if (!exported) {
      uiImportHits.push({ filePath, specifier });
    }
  }
}

if (uiImportHits.length > 0) {
  fail(
    [
      "Fava Beta imports unexported @lapis/ui subpaths:",
      ...uiImportHits.map(
        (hit) => `  - ${relative(hit.filePath)}: ${hit.specifier}`,
      ),
    ].join("\n"),
  );
}

if (errors.length > 0) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log(
  finalAudit
    ? "Fava migration final audit passed."
    : "Fava migration boundary audit passed.",
);
