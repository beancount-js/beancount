import {
  defineConfig,
  headingRequirements,
  singleIdVerification,
} from "@lapismd/spec-validator";

const architecture = "spec/src/app-baseline.md";
const language = "spec/src/beancount-language.md";
const accounting = "spec/src/accounting-and-query.md";
const application = "spec/src/application-ui.md";
const ingestion = "spec/src/ingestion-and-rules.md";
const hosts = "spec/src/hosts-and-storage.md";
const catalog = "spec/src/storybook-catalog.md";
const governance = "spec/src/spec-governance.md";

export default defineConfig(headingRequirements(), {
  name: "beancount-studio",
  idPattern: /^BC-[A-Z]+-\d{3}$/,
  ruleIds: {
    governance: "BC-GOV-001",
    fileLimits: "BC-GOV-001",
    qmd: "BC-GOV-002",
    summary: "BC-GOV-001",
    verification: "BC-GOV-001",
    book: "BC-GOV-002",
    bookIgnore: "BC-GOV-002",
    specFirst: "BC-GOV-003",
    internal: "BC-GOV-004",
    storybookMirrors: "BC-CAT-003",
  },
  validators: {
    summary: true,
    governance: { extras: ["AGENTS.md", "README.md"] },
    fileLimits: { maxLines: 400, maxBytes: 32768 },
    verification: singleIdVerification(),
    book: true,
    qmd: { collection: "beancount-spec", configPath: ".qmd/index.yml" },
    storybookMirrors: {
      style: "src-spec-mdx",
      directory: "packages/ui/catalog/spec",
      titlePrefix: "Specification",
      verifyTarget: true,
      verifyTitle: true,
      verifyContent: true,
      previewPath: "packages/ui/.storybook/preview.ts",
      verifyOrder: true,
    },
    specFirst: {
      mode: "mapped",
      canonicalPattern:
        "^spec/src/(?:app-baseline|beancount-language|accounting-and-query|application-ui|ingestion-and-rules|hosts-and-storage|storybook-catalog|spec-governance)\\.md$",
      protected: [
        "^(?:packages/|scripts/|\\.storybook/|\\.github/|package\\.json$|pnpm-lock\\.yaml$|pnpm-workspace\\.yaml$|turbo\\.json$|spec-validator\\.config\\.mjs$|spec/book\\.toml$|\\.qmd/|\\.gitignore$|AGENTS\\.md$)",
      ],
      ignore: [
        "(^|/)(?:node_modules|dist|build-server|build-web|storybook-static|spec/book|\\.svelte-kit|\\.turbo|coverage|test-results|playwright-report)/",
        "\\.(?:spec|test)\\.[cm]?[jt]sx?$",
        "\\.stories\\.(?:svelte|[cm]?[jt]sx?)$",
        "\\.mdx$",
        "(^|/)(?:fixtures|__fixtures__)/",
        "^pnpm-lock\\.yaml$",
      ],
      rules: [
        {
          pattern:
            "^(?:packages/(?:parser|codemirror-lang-beancount)/|packages/beancount/src/parser/)",
          chapters: [language],
        },
        {
          pattern:
            "^(?:packages/(?:beancount|filters|beanquery)/|packages/beancount/src/(?:core|ops|plugins|query)/)",
          chapters: [accounting, language],
        },
        {
          pattern: "^packages/ui/src/",
          chapters: [application],
        },
        {
          pattern:
            "^packages/(?:beangulp|connector-[^/]+|server)/(?:src/|package\\.json$)",
          chapters: [ingestion],
        },
        {
          pattern: "^packages/(?:app|workspace|web|cli)/",
          chapters: [hosts],
        },
        {
          pattern: "^(?:packages/ui/(?:catalog|\\.storybook)/|\\.storybook/)",
          chapters: [catalog],
        },
        {
          pattern:
            "^(?:scripts/|\\.github/|package\\.json$|pnpm-workspace\\.yaml$|turbo\\.json$|spec-validator\\.config\\.mjs$|spec/book\\.toml$|\\.qmd/|\\.gitignore$|AGENTS\\.md$)",
          chapters: [architecture, governance],
        },
        { pattern: ".*", chapters: [architecture, governance] },
      ],
    },
  },
  check: {
    build: true,
    first: true,
    lanes: [
      { name: "baseline", command: "pnpm", args: ["check:baseline"] },
      {
        name: "source-catalog",
        command: "pnpm",
        args: ["--filter", "@beancount-js/ui", "check:catalog"],
      },
    ],
  },
});
