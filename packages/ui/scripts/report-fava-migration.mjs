import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const trackerPath = path.join(repoRoot, "packages/ui/FAVA_MIGRATION.md");
const tracker = readFileSync(trackerPath, "utf8");
const jsonOutput = process.argv.includes("--json");

function tableRows(prefix) {
  const pattern = new RegExp(
    `^\\|\\s*(${prefix}\\d{2,3})\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|`,
    "gm",
  );
  return [...tracker.matchAll(pattern)].map((match) => ({
    id: match[1],
    label: match[2].trim(),
    status: match[3].trim(),
  }));
}

function gateRows() {
  return [
    ...tracker.matchAll(
      /^\|\s*(G\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm,
    ),
  ].map((match) => ({
    id: match[1],
    label: match[2].trim(),
    review: match[3].trim(),
    status: match[4].trim(),
  }));
}

function section(title, endPattern) {
  const start = tracker.indexOf(title);
  if (start === -1) return "";
  const rest = tracker.slice(start + title.length);
  const end = rest.search(endPattern);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

function printSection(title, body) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
  console.log(body || "No section found.");
}

const gates = gateRows();
const componentRows = tableRows("C");
const doneComponents = componentRows.filter((row) => row.status === "Done");
const incompleteComponents = componentRows.filter((row) => row.status !== "Done");
const commands = [
  { label: "Preflight", command: "pnpm validate:fava-migration:preflight" },
  { label: "Final", command: "pnpm validate:fava-migration" },
  { label: "C006", command: "pnpm test:c006" },
  { label: "UI C006", command: "pnpm test:ui:c006" },
  { label: "Beta C006", command: "pnpm test:e2e:beta:c006" },
  { label: "Boundary", command: "pnpm audit:fava-migration" },
  { label: "Final audit", command: "pnpm audit:fava-migration:final" },
];
const c006Evidence = section(
  'Required evidence before marking C006 `Done`:',
  /\nRequired evidence before marking G03 `Accepted`:/,
);
const g03Evidence = section(
  'Required evidence before marking G03 `Accepted`:',
  /\n#### C007|\n## Current execution focus/,
);
const c006 = componentRows.find((row) => row.id === "C006");
const g03 = gates.find((row) => row.id === "G03");
const nextCommand =
  componentRows.length === 70 && incompleteComponents.length === 0
    ? "pnpm validate:fava-migration"
    : "pnpm validate:fava-migration:preflight";
const summary = {
  c006Status: c006?.status ?? "missing",
  c006Complete: c006?.status === "Done",
  g03Status: g03?.status ?? "missing",
  g03Accepted: g03?.status === "Accepted",
  componentsComplete:
    componentRows.length === 70 && incompleteComponents.length === 0,
  nextCommand,
};

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        summary,
        gates,
        components: {
          total: componentRows.length,
          done: doneComponents.length,
          incomplete: incompleteComponents,
        },
        commands,
        evidence: {
          c006: c006Evidence,
          g03: g03Evidence,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log("Fava migration status");
console.log("=====================");

console.log("\nGates");
console.log("-----");
for (const row of gates) {
  console.log(`${row.id}: ${row.status} - ${row.label}`);
}

console.log("\nComponents");
console.log("----------");
console.log(`${doneComponents.length}/${componentRows.length} component rows are Done.`);
if (incompleteComponents.length > 0) {
  console.log("Incomplete rows:");
  for (const row of incompleteComponents) {
    console.log(`- ${row.id}: ${row.status} - ${row.label}`);
  }
} else {
  console.log("All component rows are Done.");
}

console.log("\nCommands");
console.log("--------");
for (const { label, command } of commands) {
  console.log(`${label}: ${command}`);
}

printSection(
  "C006 required evidence",
  c006Evidence,
);

printSection(
  "G03 required evidence",
  g03Evidence,
);
