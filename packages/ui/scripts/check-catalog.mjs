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
const routes = inventory.routes;
for (const specifier of inventory.sharedImports) import.meta.resolve(specifier);
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
  `Catalog coverage passed: ${routes.length} application routes and ${inventory.navigationStates.length} navigation states, ${inventory.tableFamilies.length} table families, ${canonicalSpecFiles.size} specification chapters, ${documentedStoryFamilies} documented story families, ${publicComponents.length} public components and ${inventory.sharedImports.length} public Design Core imports.`,
);
