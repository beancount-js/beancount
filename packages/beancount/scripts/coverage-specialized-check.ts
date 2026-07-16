import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface CoverageSummary {
  branches: { pct: number | "Unknown" };
}

const minimumBranchCoverage = 95;
const targetFiles = [
  "src/parser/booking.ts",
  "src/core/inventory.ts",
  "src/core/prices.ts",
  "src/parser/loader.ts",
];
const summaryPath = fileURLToPath(
  new URL("../coverage/coverage-summary.json", import.meta.url),
);
const coverage = JSON.parse(readFileSync(summaryPath, "utf8")) as Record<
  string,
  CoverageSummary
>;

const failures = targetFiles.flatMap((target) => {
  const [path, summary] = Object.entries(coverage).find(([path]) =>
    path.endsWith(`/${target}`),
  ) ?? [undefined, undefined];
  if (!path || !summary || typeof summary.branches.pct !== "number") {
    return [`${target}: missing branch coverage summary`];
  }
  if (summary.branches.pct < minimumBranchCoverage) {
    return [
      `${target}: ${summary.branches.pct}% branches (minimum ${minimumBranchCoverage}%)`,
    ];
  }
  return [];
});

if (failures.length > 0) {
  throw new Error(
    `Specialized branch coverage audit failed:\n- ${failures.join("\n- ")}`,
  );
}

console.info(
  `Specialized branch coverage audit passed (${minimumBranchCoverage}% minimum for ${targetFiles.length} files).`,
);
