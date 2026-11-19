import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const inventory = JSON.parse(readFileSync("CATALOG_INVENTORY.json", "utf8"));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(dir, entry.name))
      : [resolve(dir, entry.name)],
  );
}
const publicImports = new Set();
for (const file of files("src").filter((name) =>
  /\.(ts|svelte|css|scss)$/.test(name),
)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/["'](@lapismd\/design-core[^"']*)["']/g))
    publicImports.add(match[1]);
}
if (
  JSON.stringify([...publicImports].sort()) !==
  JSON.stringify([...inventory.sharedImports].sort())
)
  throw new Error(
    "Catalog Design Core import inventory no longer matches production source.",
  );
function referenceFile(path) {
  return execFileSync(
    "jj",
    ["file", "show", "-r", inventory.referenceCommit, path],
    {
      cwd: resolve("../.."),
      encoding: "utf8",
    },
  );
}
const referencePaths = execFileSync(
  "jj",
  ["file", "list", "-r", inventory.referenceCommit],
  {
    cwd: resolve("../.."),
    encoding: "utf8",
  },
).split("\n");
for (const path of inventory.replacedReferenceChrome)
  if (
    !referencePaths.some(
      (name) =>
        name === `packages/fava/${path}` ||
        name.startsWith(`packages/fava/${path}/`),
    )
  )
    throw new Error(`Unknown reference chrome: ${path}`);
for (const { source, target } of inventory.referenceFixtures)
  if (referenceFile(source) !== readFileSync(target, "utf8"))
    throw new Error(`Fixture differs from pinned Fava reference: ${target}`);
const reference = referenceFile("packages/fava/src/Main.svelte");
const routes = [
  ...reference.matchAll(/\{ path: "([^"]+)", element: (\w+) \}/g),
].map((match) => ({ route: match[1], component: match[2] }));
if (
  JSON.stringify(routes) !==
  JSON.stringify(
    inventory.routes.map(({ route, component }) => ({ route, component })),
  )
)
  throw new Error(
    "Catalog route inventory no longer matches the frozen reference.",
  );
for (const specifier of inventory.sharedImports) import.meta.resolve(specifier);
const provenance = JSON.parse(readFileSync("UI_PROVENANCE.json", "utf8"));
const provenancePaths = new Set(
  execFileSync("jj", ["file", "list", "-r", provenance.sourceCommit], {
    cwd: resolve("../.."),
    encoding: "utf8",
  }).split("\n"),
);
for (const entry of provenance.copied) {
  if (!existsSync(entry.target))
    throw new Error(`Missing adapted source: ${entry.target}`);
  if (!provenancePaths.has(entry.source))
    throw new Error(`Missing provenance source: ${entry.source}`);
}
function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
const stories = new Set();
const componentDocs = new Set(["beancount-component-reference--docs"]);
let documentedStoryFamilies = 0;
for (const name of readdirSync("catalog").filter((name) =>
  name.endsWith(".stories.svelte"),
)) {
  const source = readFileSync(resolve("catalog", name), "utf8");
  const title = /title:\s*"([^"]+)"/.exec(source)?.[1];
  const docsPath = resolve(
    "catalog",
    name.replace(/\.stories\.svelte$/, ".mdx"),
  );
  if (!title || !existsSync(docsPath))
    throw new Error(`Missing catalog family documentation: ${name}`);
  const docs = readFileSync(docsPath, "utf8");
  if (
    !docs.includes(`from "./${name}"`) ||
    !/<Meta\s+of=\{[A-Za-z][A-Za-z0-9]*\}\s*\/>/.test(docs) ||
    !/^#\s+\S/m.test(docs) ||
    docs.length < 400
  )
    throw new Error(`Incomplete catalog family documentation: ${docsPath}`);
  documentedStoryFamilies += 1;
  componentDocs.add(`${slug(title)}--docs`);
  for (const story of source.matchAll(/<Story\s+name="([^"]+)"/g))
    stories.add(`${slug(title)}--${slug(story[1])}`);
}
const componentReference = readFileSync(
  resolve("catalog/ComponentReference.mdx"),
  "utf8",
);
const publicComponents = [
  ...readFileSync("src/index.ts", "utf8").matchAll(
    /export\s+\{\s*default\s+as\s+(\w+)\s*\}/g,
  ),
].map((match) => match[1]);
for (const component of publicComponents)
  if (!componentReference.includes(`\`${component}\``))
    throw new Error(`Missing public component documentation: ${component}`);
for (const { storyId } of inventory.routes)
  if (!stories.has(storyId)) throw new Error(`Missing route story: ${storyId}`);
for (const group of ["navigationStates", "tableFamilies"]) {
  if (!inventory[group]?.length) throw new Error(`Missing ${group} inventory.`);
  for (const { storyId } of inventory[group])
    if (!stories.has(storyId))
      throw new Error(`Missing ${group} story: ${storyId}`);
}
const specRoot = resolve("../../spec/src");
const canonicalSpecFiles = new Set(
  files(specRoot).filter(
    (name) => name.endsWith(".md") && !name.endsWith("/SUMMARY.md"),
  ),
);
const specificationDocs = new Set();
const mirroredSpecFiles = new Set();
for (const mirror of files("catalog/spec").filter((name) =>
  name.endsWith(".mdx"),
)) {
  const source = readFileSync(mirror, "utf8");
  const rawImport = /import\s+content\s+from\s+"([^"]+)\?raw"/.exec(
    source,
  )?.[1];
  const title = /<Meta\s+title="(Specification\/[^"]+)"\s*\/>/.exec(
    source,
  )?.[1];
  if (!rawImport || !title)
    throw new Error(`Invalid specification mirror: ${mirror}`);
  const canonical = resolve(dirname(mirror), rawImport);
  if (!canonicalSpecFiles.has(canonical))
    throw new Error(`Specification mirror has no canonical source: ${mirror}`);
  if (mirroredSpecFiles.has(canonical))
    throw new Error(`Duplicate specification mirror: ${canonical}`);
  mirroredSpecFiles.add(canonical);
  specificationDocs.add(`${slug(title)}--docs`);
}
for (const canonical of canonicalSpecFiles)
  if (!mirroredSpecFiles.has(canonical))
    throw new Error(`Missing specification mirror: ${canonical}`);
if (process.argv.includes("--built")) {
  const index = JSON.parse(readFileSync("storybook-static/index.json", "utf8"));
  for (const id of stories)
    if (!index.entries[id]) throw new Error(`Missing built story: ${id}`);
  for (const id of specificationDocs)
    if (!index.entries[id])
      throw new Error(`Missing built specification page: ${id}`);
  for (const id of componentDocs)
    if (!index.entries[id])
      throw new Error(`Missing built component documentation: ${id}`);
}
console.log(
  `Catalog coverage passed: ${routes.length} reference routes and ${inventory.navigationStates.length} navigation states, ${inventory.tableFamilies.length} table families, ${canonicalSpecFiles.size} specification chapters, ${documentedStoryFamilies} documented story families, ${publicComponents.length} public components and ${inventory.sharedImports.length} public Design Core imports.`,
);
