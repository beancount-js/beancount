import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const EXACT_UTILITIES = new Set([
  "absolute",
  "block",
  "capitalize",
  "contents",
  "cursor-pointer",
  "fixed",
  "flex",
  "grid",
  "grow",
  "hidden",
  "inline",
  "inline-block",
  "inline-flex",
  "invisible",
  "italic",
  "lowercase",
  "not-italic",
  "relative",
  "select-none",
  "shrink",
  "sr-only",
  "static",
  "sticky",
  "table",
  "table-cell",
  "table-row",
  "truncate",
  "underline",
  "uppercase",
  "visible",
  "whitespace-nowrap",
]);

const NATIVE_CLASS_EXEMPTIONS = new Set(["scroll-container"]);

const UTILITY_PREFIX =
  /^(?:accent|align|animate|appearance|aspect|backdrop|basis|bg|blur|border|bottom|box|break|brightness|caption|caret|clear|col|columns|content|contrast|cursor|decoration|delay|divide|drop|duration|ease|end|fill|filter|flex|float|font|gap|grayscale|grid|grow|h|hue|hyphens|indent|inset|invert|isolation|items|justify|leading|left|line|list|m|max-h|max-w|mb|me|min-h|min-w|ml|mr|ms|mt|mx|my|object|opacity|order|origin|outline|overflow|overscroll|p|pb|pe|perspective|pl|place|pointer-events|pr|ps|pt|px|py|resize|right|ring|rotate|rounded|row|saturate|scale|scroll|self|shadow|shrink|size|skew|snap|space|start|stroke|table|text|top|touch|tracking|transition|translate|underline|w|whitespace|will-change|z)-/;

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function stringLiterals(source, baseOffset = 0) {
  const values = [];
  const literal = /(["'`])(?:\\.|(?!\1)[^\\])*\1/g;

  for (const match of source.matchAll(literal)) {
    values.push({
      value: match[0].slice(1, -1),
      offset: baseOffset + (match.index ?? 0),
    });
  }

  return values;
}

function expressionLiterals(source, expressionPattern) {
  const values = [];

  for (const match of source.matchAll(expressionPattern)) {
    const expression = match[1] ?? "";
    const expressionOffset = (match.index ?? 0) + match[0].indexOf(expression);
    values.push(...stringLiterals(expression, expressionOffset));
  }

  return values;
}

function callExpressionLiterals(source) {
  const values = [];
  const callPattern = /\b(?:cn|clsx|createVariants)\s*\(/g;

  for (const match of source.matchAll(callPattern)) {
    const expressionOffset = (match.index ?? 0) + match[0].length;
    let index = expressionOffset;
    let depth = 1;
    let quote = "";

    while (index < source.length && depth > 0) {
      const character = source[index];
      if (quote) {
        if (character === "\\") {
          index += 2;
          continue;
        }
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
      }
      index += 1;
    }

    const expression = source.slice(expressionOffset, index - 1);
    values.push(...stringLiterals(expression, expressionOffset));
  }

  return values;
}

function classFunctionLiterals(source) {
  const values = [];
  const functionPattern =
    /\bfunction\s+[A-Za-z_$][\w$]*(?:Class|Classes)\s*\([^)]*\)\s*\{/g;

  for (const match of source.matchAll(functionPattern)) {
    const bodyOffset = (match.index ?? 0) + match[0].length;
    let index = bodyOffset;
    let depth = 1;
    let quote = "";

    while (index < source.length && depth > 0) {
      const character = source[index];
      if (quote) {
        if (character === "\\") {
          index += 2;
          continue;
        }
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
      }
      index += 1;
    }

    const body = source.slice(bodyOffset, index - 1);
    values.push(...stringLiterals(body, bodyOffset));
  }

  return values;
}

function classValues(source) {
  const values = [];

  for (const match of source.matchAll(
    /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
  )) {
    values.push({
      value: match[1] ?? match[2] ?? match[3] ?? "",
      offset: match.index ?? 0,
    });
  }

  values.push(
    ...expressionLiterals(source, /\bclass\s*=\s*\{([\s\S]{0,5000}?)\}/g),
  );

  for (const match of source.matchAll(/\bclass:([A-Za-z0-9_[\]:/!-]+)/g)) {
    values.push({ value: match[1], offset: match.index ?? 0 });
  }

  for (const match of source.matchAll(
    /\b(?:base|className|classNames|classes|[A-Za-z_$][\w$]*(?:Class|Classes))\s*[:=]\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,
  )) {
    values.push({
      value: match[2] ?? "",
      offset: match.index ?? 0,
    });
  }

  if (/\btv\s*\(/.test(source)) {
    values.push(...stringLiterals(source));
  }

  values.push(
    ...expressionLiterals(
      source,
      /\b[A-Za-z_$][\w$]*(?:Class|Classes)\s*=\s*([^\n;]*(?:\?\?|&&|\|\||\?)[^\n;]+)/g,
    ),
  );
  values.push(...callExpressionLiterals(source));
  values.push(...classFunctionLiterals(source));

  return values;
}

function stripVariants(token) {
  const lastVariant = token.lastIndexOf(":");
  return lastVariant >= 0 ? token.slice(lastVariant + 1) : token;
}

export function isTailwindUtility(token) {
  if (
    !token ||
    /^cn-[a-z0-9_-]+$/i.test(token) ||
    NATIVE_CLASS_EXEMPTIONS.has(token)
  ) {
    return false;
  }

  const normalized = token.replace(/^!/, "").replace(/^-/, "");
  if (normalized === "sr-only" || normalized === "not-sr-only") return false;
  if (normalized.startsWith("[")) return true;

  const candidate = stripVariants(normalized)
    .replace(/^!/, "")
    .replace(/^-/, "");
  if (candidate.startsWith("[")) return true;
  return EXACT_UTILITIES.has(candidate) || UTILITY_PREFIX.test(candidate);
}

export function findTailwindUtilitiesInSource(source, file) {
  const findings = [];
  const seen = new Set();

  if (
    /from\s+["']tailwind-variants["']/.test(source) ||
    /\btv\s*\(/.test(source)
  ) {
    findings.push({ file, line: 1, token: "tailwind-variants" });
    seen.add(`${file}:1:tailwind-variants`);
  }

  for (const classValue of classValues(source)) {
    for (const token of classValue.value.split(/\s+/).filter(Boolean)) {
      if (!isTailwindUtility(token)) continue;

      const line = lineAt(source, classValue.offset);
      const key = `${file}:${line}:${token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ file, line, token });
    }
  }

  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.token.localeCompare(right.token),
  );
}

function isExcluded(path) {
  const normalized = path.split(sep).join("/");
  return (
    normalized.includes("/node_modules/") ||
    normalized.includes("/storybook-static/") ||
    normalized.includes("/examples/") ||
    /\.stories\.svelte$/.test(normalized) ||
    /\.variations\.stories\.svelte$/.test(normalized) ||
    /\.(?:spec|test)\.ts$/.test(normalized)
  );
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (isExcluded(path)) continue;
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)));
    } else if (entry.isFile() && /\.(?:svelte|ts)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

export async function collectTailwindFindings(roots, cwd = process.cwd()) {
  const findings = [];

  for (const root of roots) {
    const absoluteRoot = resolve(cwd, root);
    for (const file of await sourceFiles(absoluteRoot)) {
      const source = await readFile(file, "utf8");
      findings.push(
        ...findTailwindUtilitiesInSource(source, relative(cwd, file)),
      );
    }
  }

  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.token.localeCompare(right.token),
  );
}

function groupedCounts(findings) {
  const files = {};

  for (const finding of findings) {
    files[finding.file] ??= {};
    files[finding.file][finding.token] =
      (files[finding.file][finding.token] ?? 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(files)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, tokens]) => [
        file,
        Object.fromEntries(
          Object.entries(tokens).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
      ]),
  );
}

export function createTailwindBaseline(findings, roots) {
  return {
    version: 1,
    roots: [...roots],
    files: groupedCounts(findings),
  };
}

export function compareTailwindBaseline(findings, baseline) {
  const current = groupedCounts(findings);
  const additions = [];

  for (const [file, tokens] of Object.entries(current)) {
    for (const [token, count] of Object.entries(tokens)) {
      const allowed = baseline.files?.[file]?.[token] ?? 0;
      if (count > allowed) {
        additions.push({ file, token, allowed, count });
      }
    }
  }

  return additions.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.token.localeCompare(right.token),
  );
}
