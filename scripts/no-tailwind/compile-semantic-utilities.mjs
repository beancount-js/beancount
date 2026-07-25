import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { findTailwindUtilitiesInSource } from "./no-tailwind-utilities.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const uiRoot = join(repositoryRoot, "packages/ui");
const uiRequire = createRequire(join(uiRoot, "package.json"));
const tailwindPackage = uiRequire.resolve("tailwindcss/package.json");
const tailwindRequire = createRequire(tailwindPackage);
const postcss = tailwindRequire("postcss");
const escapeClassNameModule = uiRequire("tailwindcss/lib/util/escapeClassName");
const escapeClassName = escapeClassNameModule.default ?? escapeClassNameModule;

const quotePattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
const classDirectivePattern = (token) =>
  new RegExp(`class:${escapeRegExp(token)}(?=\\s*=)`, "g");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slug(value) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function semanticGroupClass(token) {
  if (token === "group") return "cn-group";
  if (token.startsWith("group/")) {
    return `cn-group-${slug(token.slice("group/".length))}`;
  }
  if (token === "peer") return "cn-peer";
  if (token.startsWith("peer/")) {
    return `cn-peer-${slug(token.slice("peer/".length))}`;
  }
  return null;
}

function semanticVariantsImport(file) {
  let importPath = relative(
    dirname(file),
    "src/lib/semantic-variants.js",
  ).replaceAll("\\\\", "/");
  if (!importPath.startsWith(".")) importPath = `./${importPath}`;
  return importPath;
}

function sourceMarkerStem(file, family) {
  let source = file.replace(/^src\/components\//, "").replace(/\.[^.]+$/, "");
  if (source.startsWith(`${family}/`)) {
    source = source.slice(family.length + 1);
  }
  return slug(source);
}

function embeddedUtilityPattern(token) {
  return new RegExp(
    `(^|[\\s\"'\\\`{(:,])${escapeRegExp(token)}(?=$|[\\s\"'\\\`},)])`,
  );
}

function classLiteralCandidates(content) {
  return content
    .split(/\s+/)
    .map((word) =>
      word.replace(/^[${}\"'`(),?]+/, "").replace(/[{}\"'`(),?]+$/, ""),
    )
    .filter(Boolean);
}

function classifyClassLiteral(content, file) {
  const candidates = classLiteralCandidates(content);
  if (candidates.length === 0) return new Set();

  return new Set(
    findTailwindUtilitiesInSource(
      `<div class="${candidates.join(" ")}"></div>`,
      file,
    ).map((finding) => finding.token),
  );
}

function normalizeFindingToken(token) {
  return token.replace(/^[{\"'`]+/, "").replace(/[}\"'`,]+$/, "");
}

function nearestTokenLine(lines, reportedLine, token) {
  const reportedIndex = reportedLine - 1;
  if (lines[reportedIndex]?.includes(token)) return reportedLine;

  let nearest = reportedLine;
  let distance = Number.POSITIVE_INFINITY;
  lines.forEach((line, index) => {
    if (!line.includes(token)) return;
    const nextDistance = Math.abs(index - reportedIndex);
    if (nextDistance < distance) {
      nearest = index + 1;
      distance = nextDistance;
    }
  });
  return nearest;
}

function authoredStyleClasses(source) {
  const classes = new Set();
  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  const classPattern = /(?:^|[^\\])\.([_a-zA-Z][\w-]*)/g;

  for (const styleMatch of source.matchAll(stylePattern)) {
    for (const classMatch of styleMatch[1].matchAll(classPattern)) {
      classes.add(classMatch[1]);
    }
  }

  return classes;
}

export function transformClassContexts({ source, file, family }) {
  const findings = findTailwindUtilitiesInSource(source, file);
  const tokensByLine = new Map();
  const lines = source.split("\n");
  const preservedClasses = authoredStyleClasses(source);

  for (const finding of findings) {
    if (finding.token === "tailwind-variants") continue;
    const token = normalizeFindingToken(finding.token);
    const lineNumber = nearestTokenLine(lines, finding.line, token);
    const tokens = tokensByLine.get(lineNumber) ?? new Set();
    tokens.add(token);
    tokensByLine.set(lineNumber, tokens);
  }

  const mappings = [];
  const groupClasses = new Map();
  const familyMarkerPrefix = `cn-${slug(family)}-`;
  const markerStem = sourceMarkerStem(file, family);

  lines.forEach((line, index) => {
    if (line.includes(familyMarkerPrefix) && !tokensByLine.has(index + 1)) {
      tokensByLine.set(index + 1, new Set());
    }
  });

  for (const [lineNumber, tokens] of tokensByLine) {
    const index = lineNumber - 1;
    let occurrence = 0;
    const consumed = new Set();

    lines[index] = lines[index].replace(quotePattern, (literal) => {
      const quote = literal[0];
      const content = literal.slice(1, -1);
      const words = content.split(/\s+/).filter(Boolean);
      const candidates = classLiteralCandidates(content);
      const existingMarker = words.find((word) =>
        word.startsWith(familyMarkerPrefix),
      );
      const confirmedUtilities = candidates.filter(
        (word) => tokens.has(word) || semanticGroupClass(word),
      );

      if (confirmedUtilities.length === 0 && !existingMarker) return literal;

      const classifiedUtilities = classifyClassLiteral(content, file);
      for (const utility of classifiedUtilities) tokens.add(utility);

      if (quote === "`" && content.includes("${")) return literal;

      const utilities = words.filter(
        (word) =>
          !word.startsWith("cn-") &&
          word !== "sr-only" &&
          word !== "not-sr-only" &&
          !preservedClasses.has(word),
      );
      if (utilities.length === 0) return literal;

      occurrence += 1;
      const marker =
        existingMarker ??
        `cn-${slug(family)}-${markerStem}-${lineNumber}-${occurrence}`;
      const semanticGroups = [];

      for (const utility of utilities) {
        consumed.add(utility);
        const semanticGroup = semanticGroupClass(utility);
        if (semanticGroup) {
          semanticGroups.push(semanticGroup);
          groupClasses.set(utility, semanticGroup);
        }
      }

      mappings.push({ marker, utilities });
      const remaining = words.filter(
        (word) => word !== marker && !utilities.includes(word),
      );
      return `${quote}${[marker, ...semanticGroups, ...remaining].join(" ")}${quote}`;
    });

    for (const token of tokens) {
      if (consumed.has(token)) continue;
      const directive = classDirectivePattern(token);
      if (directive.test(lines[index])) {
        occurrence += 1;
        const marker = `cn-${slug(family)}-${markerStem}-${lineNumber}-${occurrence}`;
        lines[index] = lines[index].replace(directive, `class:${marker}`);
        mappings.push({ marker, utilities: [token] });
        consumed.add(token);
        continue;
      }

      const embedded = embeddedUtilityPattern(token);
      if (!embedded.test(lines[index])) continue;

      occurrence += 1;
      const marker = `cn-${slug(family)}-${markerStem}-${lineNumber}-${occurrence}`;
      lines[index] = lines[index].replace(embedded, `$1${marker}`);
      mappings.push({ marker, utilities: [token] });
      consumed.add(token);
    }
  }

  const variantsImport = semanticVariantsImport(file);
  let transformed = lines.join("\n");
  transformed = transformed
    .replace(
      /import\s*\{\s*type VariantProps,\s*tv\s*\}\s*from\s*"tailwind-variants";/g,
      `import { createVariants, type VariantProps } from "${variantsImport}";`,
    )
    .replace(
      /import\s*\{\s*tv,\s*type VariantProps\s*\}\s*from\s*"tailwind-variants";/g,
      `import { createVariants, type VariantProps } from "${variantsImport}";`,
    )
    .replace(
      /import\s*\{\s*tv\s*,?\s*\}\s*from\s*"tailwind-variants";/g,
      `import { createVariants } from "${variantsImport}";`,
    );

  if (!transformed.includes('"tailwind-variants"')) {
    transformed = transformed.replace(/\btv\(/g, "createVariants(");
  }

  const residual = findTailwindUtilitiesInSource(transformed, file);
  if (residual.length > 0) {
    const summary = residual
      .slice(0, 10)
      .map((finding) => `${finding.line}:${finding.token}`)
      .join(", ");
    throw new Error(`Residual Tailwind findings in ${file}: ${summary}`);
  }

  return { source: transformed, mappings, groupClasses };
}

function injectDataIdentity(source, family, part) {
  if (source.includes(`data-ui-component="${family}"`)) return source;

  const scriptEnd = source.lastIndexOf("</script>");
  const markupStart = scriptEnd >= 0 ? scriptEnd + "</script>".length : 0;
  const tagPattern =
    /^[ \t]*<(?!\/|!|style\b|script\b|svelte:)([A-Za-z][A-Za-z0-9_.:-]*)\b/gm;
  tagPattern.lastIndex = markupStart;
  let match = tagPattern.exec(source);
  while (match?.[1].endsWith("Portal") || match?.[1] === "Dialog.Root") {
    match = tagPattern.exec(source);
  }
  if (!match) return source;

  let cursor = match.index + match[0].length;
  let quote = null;
  let braceDepth = 0;

  while (cursor < source.length) {
    const character = source[cursor];
    if (quote) {
      if (character === quote && source[cursor - 1] !== "\\") quote = null;
    } else if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      braceDepth += 1;
    } else if (character === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (character === ">" && braceDepth === 0) {
      const insertion = ` data-ui-component="${family}" data-ui-part="${part}"`;
      const insertionIndex = source[cursor - 1] === "/" ? cursor - 1 : cursor;
      return `${source.slice(0, insertionIndex)}${insertion}${source.slice(insertionIndex)}`;
    }
    cursor += 1;
  }

  return source;
}

function appendWithAncestors(outputRoot, rule) {
  let node = rule;
  let parent = rule.parent;

  while (parent && parent.type !== "root") {
    const wrapper = parent.clone({ nodes: [] });
    wrapper.append(node);
    node = wrapper;
    parent = parent.parent;
  }

  outputRoot.append(node);
}

function compileFamilyCss({
  family,
  mappings,
  groupClasses,
  temporaryDirectory,
}) {
  const utilities = [
    ...new Set(mappings.flatMap((mapping) => mapping.utilities)),
  ];
  if (utilities.length === 0) {
    return "/* This direct behavior primitive has no authored presentation styles. */\n";
  }

  const contentPath = join(temporaryDirectory, `${family}.classes.js`);
  const inputPath = join(temporaryDirectory, `${family}.input.css`);
  const outputPath = join(temporaryDirectory, `${family}.output.css`);
  writeFileSync(contentPath, `export default ${JSON.stringify(utilities)};\n`);
  writeFileSync(inputPath, "@tailwind utilities;\n");

  execFileSync(
    join(uiRoot, "node_modules/.bin/tailwindcss"),
    [
      "-c",
      join(repositoryRoot, "packages/fava-beta/tailwind.config.ts"),
      "-i",
      inputPath,
      "-o",
      outputPath,
      "--content",
      contentPath,
    ],
    { cwd: repositoryRoot, stdio: "pipe" },
  );

  const compiled = postcss.parse(readFileSync(outputPath, "utf8"));
  const output = postcss.root();
  const markerByUtility = new Map();

  for (const mapping of mappings) {
    for (const utility of mapping.utilities) {
      const markers = markerByUtility.get(utility) ?? new Set();
      markers.add(mapping.marker);
      markerByUtility.set(utility, markers);
    }
  }

  for (const keyframes of compiled.nodes.filter(
    (node) => node.type === "atrule" && node.name === "keyframes",
  )) {
    output.append(keyframes.clone());
  }

  compiled.walkRules((rule) => {
    for (const [utility, markers] of markerByUtility) {
      const utilitySelector = `.${escapeClassName(utility)}`;
      if (!rule.selector.includes(utilitySelector)) continue;

      for (const marker of markers) {
        const clone = rule.clone();
        clone.selector = clone.selector.replaceAll(
          utilitySelector,
          `.${marker}`,
        );

        for (const [groupUtility, semanticClass] of groupClasses) {
          clone.selector = clone.selector.replaceAll(
            `.${escapeClassName(groupUtility)}`,
            `.${semanticClass}`,
          );
        }

        appendWithAncestors(output, clone);
      }
    }
  });

  return `/* Generated once from the former utility recipes; no Tailwind runtime is required. */\n${output
    .toString()
    .replaceAll("--tw-", "--ui-runtime-")
    .replace(/\/\*![\s\S]*?\*\//g, "")}\n`;
}

function sanitizeTokenCss(css) {
  const replacements = new Map([
    ["var(--background)", "var(--ui-color-background)"],
    ["var(--foreground)", "var(--ui-color-foreground)"],
    ["var(--card)", "var(--ui-color-surface)"],
    ["var(--card-foreground)", "var(--ui-color-surface-foreground)"],
    ["var(--muted)", "var(--ui-color-muted)"],
    ["var(--muted-foreground)", "var(--ui-color-muted-foreground)"],
    ["var(--primary)", "var(--ui-color-primary)"],
    ["var(--primary-foreground)", "var(--ui-color-primary-foreground)"],
    ["var(--secondary)", "var(--ui-color-secondary)"],
    ["var(--secondary-foreground)", "var(--ui-color-secondary-foreground)"],
    ["var(--accent)", "var(--ui-color-accent)"],
    ["var(--accent-foreground)", "var(--ui-color-accent-foreground)"],
    ["var(--destructive)", "var(--ui-color-destructive)"],
    ["var(--destructive-foreground)", "var(--ui-color-destructive-foreground)"],
    ["var(--border)", "var(--ui-color-border)"],
    ["var(--input)", "var(--ui-color-input)"],
    ["var(--ring)", "var(--ui-color-ring)"],
  ]);

  let sanitized = css
    .replaceAll("var(--radius-sm)", "var(--ui-radius-sm)")
    .replaceAll("var(--radius-md)", "var(--ui-radius-md)")
    .replaceAll("var(--radius-lg)", "var(--ui-radius-lg)")
    .replaceAll("var(--spacing)", "var(--ui-space-1)");

  for (const [from, to] of replacements) {
    sanitized = sanitized.replaceAll(from, to);
  }

  return sanitized;
}

function referenceTokenExport(referenceIndex, family) {
  const marker = `from "./${family}.tokens.js";`;
  const markerIndex = referenceIndex.indexOf(marker);
  if (markerIndex < 0) return null;

  const exportIndex = referenceIndex.lastIndexOf("export {", markerIndex);
  if (exportIndex < 0) return null;

  return referenceIndex.slice(exportIndex, markerIndex + marker.length);
}

function importReferenceMetadata(family, familyDirectory) {
  const referenceDirectory = join(
    process.env.NATIVE_SHADCN_REFERENCE ??
      "/Users/stevejuma/ui/src/shared/shadcn",
    family,
  );
  const tokenCssPath = join(referenceDirectory, `${family}.tokens.css`);
  const tokenTypesPath = join(referenceDirectory, `${family}.tokens.ts`);
  const provenancePath = join(referenceDirectory, `${family}.provenance.json`);

  if (
    !existsSync(tokenCssPath) ||
    !existsSync(tokenTypesPath) ||
    !existsSync(provenancePath)
  ) {
    const symbol = family.replaceAll("-", "_");
    const typeName = family
      .split("-")
      .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
      .join("");
    writeFileSync(
      join(familyDirectory, `${family}.tokens.css`),
      `:root {
  --ui-${family}-background: var(--ui-color-background);
  --ui-${family}-foreground: var(--ui-color-foreground);
  --ui-${family}-border-color: var(--ui-color-border);
  --ui-${family}-radius: var(--ui-radius-md);
}
`,
    );
    writeFileSync(
      join(familyDirectory, `${family}.tokens.ts`),
      `export const ${symbol}TokenNames = {
  background: "--ui-${family}-background",
  foreground: "--ui-${family}-foreground",
  borderColor: "--ui-${family}-border-color",
  radius: "--ui-${family}-radius",
} as const;

export type ${typeName}Token =
  (typeof ${symbol}TokenNames)[keyof typeof ${symbol}TokenNames];
`,
    );
    writeFileSync(
      join(familyDirectory, `${family}.provenance.json`),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          component: family,
          scope: "shared",
          upstream: {
            project: "beancount-js-studio",
            item: family,
          },
          converter: {
            version: "native-semantic-1",
          },
        },
        null,
        2,
      )}\n`,
    );

    const indexPath = join(familyDirectory, "index.ts");
    const index = readFileSync(indexPath, "utf8");
    if (!index.includes(`${family}.tokens.js`)) {
      writeFileSync(
        indexPath,
        `${index.trimEnd()}\n\nexport { ${symbol}TokenNames, type ${typeName}Token } from "./${family}.tokens.js";\n`,
      );
    }
    return;
  }

  for (const path of [tokenCssPath, tokenTypesPath, provenancePath]) {
    readFileSync(path);
  }

  writeFileSync(
    join(familyDirectory, `${family}.tokens.css`),
    sanitizeTokenCss(readFileSync(tokenCssPath, "utf8")),
  );
  writeFileSync(
    join(familyDirectory, `${family}.tokens.ts`),
    readFileSync(tokenTypesPath, "utf8"),
  );
  writeFileSync(
    join(familyDirectory, `${family}.provenance.json`),
    readFileSync(provenancePath, "utf8"),
  );

  const indexPath = join(familyDirectory, "index.ts");
  const referenceIndex = readFileSync(
    join(referenceDirectory, "index.ts"),
    "utf8",
  );
  const tokenExport = referenceTokenExport(referenceIndex, family);
  if (tokenExport) {
    const index = readFileSync(indexPath, "utf8");
    if (!index.includes(`${family}.tokens.js`)) {
      writeFileSync(indexPath, `${index.trimEnd()}\n\n${tokenExport}\n`);
    }
  }
}

export function migrateFamilies({ families }) {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "beancount-native-components-"),
  );
  const stylesPath = join(uiRoot, "src/styles.css");
  let styles = readFileSync(stylesPath, "utf8");

  try {
    for (const family of families) {
      const familyDirectory = join(uiRoot, "src/components/shadcn", family);
      const mappings = [];
      const groupClasses = new Map();
      const cssPath = join(familyDirectory, `${family}.css`);
      let existingCss = "";
      try {
        existingCss = readFileSync(cssPath, "utf8");
      } catch {
        existingCss = "";
      }
      const sourceFiles = readdirSync(familyDirectory)
        .filter(
          (name) =>
            (name.endsWith(".svelte") || name.endsWith(".ts")) &&
            !name.includes(".stories.") &&
            !name.includes(".spec.") &&
            !name.endsWith(".tokens.ts") &&
            name !== "index.ts",
        )
        .sort();
      const pendingWrites = new Map();

      for (const name of sourceFiles) {
        const path = join(familyDirectory, name);
        const file = relative(uiRoot, path);
        const transformed = transformClassContexts({
          source: readFileSync(path, "utf8"),
          file,
          family,
        });
        const part = slug(name);
        pendingWrites.set(
          path,
          name.endsWith(".svelte")
            ? injectDataIdentity(transformed.source, family, part)
            : transformed.source,
        );
        mappings.push(...transformed.mappings);
        for (const entry of transformed.groupClasses)
          groupClasses.set(...entry);
      }

      const css = compileFamilyCss({
        family,
        mappings,
        groupClasses,
        temporaryDirectory,
      });

      for (const [path, source] of pendingWrites) writeFileSync(path, source);
      writeFileSync(
        cssPath,
        existingCss && mappings.length === 0
          ? existingCss
          : existingCss
            ? `${existingCss.trimEnd()}\n\n${css}`
            : css,
      );
      importReferenceMetadata(family, familyDirectory);

      for (const importPath of [
        `./components/shadcn/${family}/${family}.tokens.css`,
        `./components/shadcn/${family}/${family}.css`,
      ]) {
        const statement = `@import "${importPath}";`;
        if (!styles.includes(statement))
          styles = `${styles.trimEnd()}\n${statement}\n`;
      }
    }

    writeFileSync(stylesPath, styles);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function collectProductionSources(directory) {
  const sources = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...collectProductionSources(path));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".svelte") && !entry.name.endsWith(".ts"))
      continue;
    if (
      entry.name.includes(".stories.") ||
      entry.name.includes(".spec.") ||
      entry.name.includes(".test.") ||
      entry.name.endsWith(".tokens.ts") ||
      entry.name === "index.ts"
    ) {
      continue;
    }
    sources.push(path);
  }

  return sources.sort();
}

export function migrateSharedComponents({ categories }) {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "beancount-native-compositions-"),
  );
  const stylesPath = join(uiRoot, "src/styles.css");
  let styles = readFileSync(stylesPath, "utf8");

  try {
    for (const category of categories) {
      const categoryDirectory = join(uiRoot, "src/components", category);
      if (!existsSync(categoryDirectory)) {
        throw new Error(`Unknown shared component category: ${category}`);
      }

      const mappings = [];
      const groupClasses = new Map();
      const pendingWrites = new Map();
      const cssPath = join(categoryDirectory, `${category}.native.css`);
      const existingCss = existsSync(cssPath)
        ? readFileSync(cssPath, "utf8")
        : "";

      for (const path of collectProductionSources(categoryDirectory)) {
        const file = relative(uiRoot, path);
        const transformed = transformClassContexts({
          source: readFileSync(path, "utf8"),
          file,
          family: category,
        });
        pendingWrites.set(path, transformed.source);
        mappings.push(...transformed.mappings);
        for (const entry of transformed.groupClasses) {
          groupClasses.set(...entry);
        }
      }

      const css = compileFamilyCss({
        family: `shared-${category}`,
        mappings,
        groupClasses,
        temporaryDirectory,
      });

      for (const [path, source] of pendingWrites) writeFileSync(path, source);
      writeFileSync(
        cssPath,
        existingCss && mappings.length === 0
          ? existingCss
          : existingCss
            ? `${existingCss.trimEnd()}\n\n${css}`
            : css,
      );

      const statement = `@import "./components/${category}/${category}.native.css";`;
      if (!styles.includes(statement)) {
        styles = `${styles.trimEnd()}\n${statement}\n`;
      }
    }

    writeFileSync(stylesPath, styles);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function parseFamilies(argv) {
  const familyArgument = argv.find((argument) =>
    argument.startsWith("--families="),
  );
  if (!familyArgument) return [];
  return familyArgument
    .slice("--families=".length)
    .split(",")
    .map((family) => family.trim())
    .filter(Boolean);
}

function parseSharedCategories(argv) {
  const categoryArgument = argv.find((argument) =>
    argument.startsWith("--shared="),
  );
  if (!categoryArgument) return [];
  return categoryArgument
    .slice("--shared=".length)
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const families = parseFamilies(argv);
  const categories = parseSharedCategories(argv);
  if (families.length === 0 && categories.length === 0) {
    throw new Error(
      "Pass --families=accordion,alert,... or --shared=layout,navigation,...",
    );
  }
  if (families.length > 0) migrateFamilies({ families });
  if (categories.length > 0) migrateSharedComponents({ categories });
}
