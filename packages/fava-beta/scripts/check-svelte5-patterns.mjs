#!/usr/bin/env node
/**
 * Guardrails for Svelte 5 migration in app-authored code.
 * Skips generated shadcn bits under src/lib/components/ui.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const skipDir = path.join(srcRoot, "lib", "components", "ui");

const rules = [
  {
    id: "button-on-click",
    pattern: /<Button\b[^>]*\bon:click=/g,
    message:
      "shadcn Button needs `onclick`, not `on:click` (Svelte 5 $props forwarding).",
  },
  {
    id: "legacy-trigger-slot",
    pattern: /\bslot="trigger"/g,
    message:
      "Use Svelte 5 `{#snippet trigger({ props })}` instead of `slot=\"trigger\"`.",
  },
  {
    id: "bits-builders",
    pattern: /\bbuilders=\{\[/g,
    message:
      "Replace bits-ui `builders={[builder]}` with `{...props}` from trigger snippets.",
  },
  {
    id: "let-builder",
    pattern: /\blet:builder\b/g,
    message:
      "Replace `let:builder` slot props with `{#snippet trigger({ props })}`.",
  },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (full.startsWith(skipDir)) {
      continue;
    }
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith(".svelte")) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(srcRoot);
const findings = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push({
        file: path.relative(root, file),
        line,
        rule: rule.id,
        message: rule.message,
        snippet: lines[line - 1]?.trim() ?? "",
      });
    }
  }
}

if (findings.length) {
  console.error("Svelte 5 migration pattern violations:\n");
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line} [${finding.rule}] ${finding.message}\n  ${finding.snippet}\n`,
    );
  }
  process.exit(1);
}

console.log(`Svelte 5 pattern check passed (${files.length} files scanned).`);
