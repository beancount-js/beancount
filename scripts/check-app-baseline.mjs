import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const json = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const app = json("packages/ui/package.json");
const host = json("packages/app/package.json");
const workspace = json("package.json");
assert.equal(app.name, "@beancount-js/ui");
assert.equal(host.name, "@beancount-js/app");
assert.equal(host.dependencies["@beancount-js/ui"], "workspace:*");
assert.equal(host.dependencies["@beancount-js/server"], "workspace:*");
assert.equal(host.dependencies["@beancount-js/web"], "workspace:*");
assert.equal(workspace.pnpm.overrides.svelte, app.devDependencies.svelte);
for (const name of [
  "@codemirror/state",
  "@codemirror/view",
  "@codemirror/language",
])
  assert(
    /^\d+\.\d+\.\d+$/.test(workspace.pnpm.overrides[name]),
    `${name} must resolve to one pinned application runtime.`,
  );
assert.equal(
  app.devDependencies["@vitest/browser"],
  app.devDependencies.vitest,
);
assert(
  app.dependencies["@lapismd/design-core"],
  "The active UI must consume published Design Core.",
);
assert(
  !app.dependencies["@lapis/ui"] && !app.dependencies["@beancount-js/forms"],
);
assert.equal(workspace.scripts.dev, "pnpm storybook");
assert.equal(
  workspace.scripts["dev:app"],
  "pnpm --filter @beancount-js/app dev",
);
assert.equal(
  workspace.scripts["build:app"],
  "pnpm --filter @beancount-js/app build",
);
for (const command of [
  "storybook",
  "build-storybook",
  "test:storybook",
  "checks:ui",
])
  assert(
    workspace.scripts[command].includes("--filter @beancount-js/ui "),
    `${command} must target the active package.`,
  );
const config = readFileSync(
  resolve(root, "packages/ui/.storybook/main.ts"),
  "utf8",
);
assert(config.includes("../catalog/**/*.stories.svelte"));
assert(config.includes("../catalog/**/*.mdx"));
console.log(
  "Application baseline passed: one active Design Core UI, catalog and production host.",
);
