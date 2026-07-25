#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  collectTailwindFindings,
  compareTailwindBaseline,
  createTailwindBaseline,
} from "./no-tailwind-utilities.mjs";

const args = process.argv.slice(2);
const writeBaseline = args.includes("--write-baseline");
const baselineIndex = args.indexOf("--baseline");

if (baselineIndex < 0 || !args[baselineIndex + 1]) {
  throw new Error(
    "Usage: check-no-tailwind-utilities.mjs --baseline <file> [--write-baseline] <root...>",
  );
}

const baselinePath = resolve(args[baselineIndex + 1]);
const roots = args.filter(
  (arg, index) =>
    arg !== "--write-baseline" &&
    arg !== "--baseline" &&
    index !== baselineIndex + 1,
);

if (roots.length === 0) {
  throw new Error("At least one source root is required.");
}

const findings = await collectTailwindFindings(roots);
const filesWithFindings = new Set(findings.map((finding) => finding.file)).size;

if (writeBaseline) {
  const baseline = createTailwindBaseline(findings, roots);
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `Recorded ${findings.length} Tailwind findings across ${filesWithFindings} files.`,
  );
  process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
if (baseline.version !== 1) {
  throw new Error(`Unsupported Tailwind baseline version: ${baseline.version}`);
}

const additions = compareTailwindBaseline(findings, baseline);
if (additions.length > 0) {
  console.error("New Tailwind utilities are not allowed:");
  for (const addition of additions) {
    console.error(
      `- ${addition.file}: ${addition.token} (${addition.count}, allowed ${addition.allowed})`,
    );
  }
  console.error(
    "\nMove styling into native CSS and component tokens. Baselines may only shrink.",
  );
  process.exit(1);
}

console.log(
  `Tailwind ratchet passed: ${findings.length} existing findings across ${filesWithFindings} files; no additions.`,
);
