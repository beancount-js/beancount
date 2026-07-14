/// <reference types="vitest" />
import { sveltekit } from "@sveltejs/kit/vite";
import { lezer } from "@lezer/generator/rollup";
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  define: {
    "import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME": JSON.stringify(
      process.env.VITE_BEANCOUNT_STUDIO_RUNTIME ??
        process.env.BEANCOUNT_STUDIO_RUNTIME ??
        "server",
    ),
  },
  assetsInclude: ["**/*.ledger"],
  // The grammar plugin still declares Vite 5 types, while its runtime works
  // with Vite 6. Keep the cast local until the upstream type range catches up.
  plugins: [lezer() as any, sveltekit()],
  resolve: {
    alias: [
      {
        find: "$lib",
        replacement: fileURLToPath(new URL("./src/lib", import.meta.url)),
      },
      {
        find: "@beancount-js/beancount",
        replacement: fileURLToPath(new URL("../beancount/src/index.ts", import.meta.url)),
      },
      {
        find: "@beancount-js/parser",
        replacement: fileURLToPath(new URL("../parser/src/index.ts", import.meta.url)),
      },
      {
        find: "@beancount-js/filters",
        replacement: fileURLToPath(new URL("../filters/src/index.ts", import.meta.url)),
      },
      { find: "@codemirror/text", replacement: "@codemirror/state" },
    ],
  },
  ssr: {
    noExternal: [
      "@beancount-js/forms",
      "@beancount-js/server",
      "@beancount-js/web",
      "@beancount-js/workspace",
    ],
  },
  server: { fs: { allow: [repoRoot] } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
    exclude: ["e2e/**"],
  },
});
