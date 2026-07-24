import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const uiRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = path.resolve(uiRoot, "../..");
const destination = path.join(
  workspaceRoot,
  "packages/storybook-addon-visual-delta",
);
const source =
  process.env.VISUAL_DELTA_SOURCE_DIR ??
  "/Users/stevejuma/ui/packages/storybook-addon-visual-delta";
const sourceRepository = path.resolve(source, "../..");

function run(command, args, cwd = workspaceRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed\n${detail}`.trim());
  }
  return result.stdout.trim();
}

const dirtySummary = run("jj", [
  "--repository",
  sourceRepository,
  "--no-pager",
  "--color",
  "never",
  "diff",
  "--summary",
]);
if (dirtySummary) {
  throw new Error(
    `Refusing to synchronize dirty Visual Delta source:\n${dirtySummary}`,
  );
}

const revision = run("jj", [
  "--repository",
  sourceRepository,
  "--no-pager",
  "--color",
  "never",
  "log",
  "-r",
  "@-",
  "--no-graph",
  "-T",
  "commit_id",
]);

const canonicalManifest = JSON.parse(
  readFileSync(path.join(source, "package.json"), "utf8"),
);
const localManifest = JSON.parse(
  readFileSync(path.join(destination, "package.json"), "utf8"),
);
for (const field of [
  "bin",
  "exports",
  "dependencies",
  "peerDependencies",
  "peerDependenciesMeta",
]) {
  if (
    JSON.stringify(localManifest[field]) !==
    JSON.stringify(canonicalManifest[field])
  ) {
    throw new Error(
      `Visual Delta package metadata changed in ${field}; refresh the workspace manifest and lockfile before continuing.`,
    );
  }
}

run("rsync", [
  "-a",
  "--delete",
  "--exclude=node_modules",
  "--exclude=dist",
  "--exclude=package.json",
  "--exclude=tsconfig.json",
  "--exclude=tsconfig.node-build.json",
  "--exclude=vitest.config.ts",
  "--exclude=vitest.host.setup.ts",
  `${source}/`,
  `${destination}/`,
]);

console.log(`Visual Delta source is current at ${revision}.`);
