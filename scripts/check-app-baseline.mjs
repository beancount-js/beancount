import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const json = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const app = json("packages/ui/package.json");
const host = json("packages/app/package.json");
const legacy = json("packages/ui-legacy/package.json");
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
    `${name} must resolve to one pinned runtime across both UIs.`,
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
assert(!config.includes("fava") && !config.includes("ui-legacy"));
assert.equal(legacy.name, "@lapis/ui");
for (const name of Object.keys({
  ...legacy.dependencies,
  ...legacy.devDependencies,
}))
  assert(
    !/storybook|visual-delta|@vitest\/browser/.test(name),
    `Retired catalog dependency in compatibility package: ${name}`,
  );
for (const name of Object.keys(legacy.scripts))
  assert(
    !/storybook|visual/.test(name),
    `Retired catalog command in compatibility package: ${name}`,
  );
function checkFiles(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    if (item.name === "node_modules") continue;
    const file = resolve(path, item.name);
    assert(
      !item.name.includes(".stories.") &&
        item.name !== ".storybook" &&
        item.name !== ".visual-delta" &&
        !item.name.endsWith(".mdx"),
      `Retired Storybook source in compatibility package: ${file}`,
    );
    if (item.isDirectory()) checkFiles(file);
  }
}
checkFiles(resolve(root, "packages/ui-legacy"));
console.log(
  "Application baseline passed: one active Design Core catalog and production host; compatibility UI has no Storybook runtime or sources.",
);
