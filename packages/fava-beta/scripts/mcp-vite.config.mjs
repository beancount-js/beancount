import { lezer } from "@lezer/generator/rollup";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const source = (path) => fileURLToPath(new URL(path, import.meta.url));

/** Minimal SSR loader for the stdio MCP process; no Svelte/HMR runtime. */
export default defineConfig({
  plugins: [lezer()],
  resolve: {
    alias: [
      { find: "$lib", replacement: source("../src/lib") },
      {
        find: "@beancount-js/beancount",
        replacement: source("../../beancount/src/index.ts"),
      },
      {
        find: "@beancount-js/beanquery",
        replacement: source("../../beanquery/src/index.ts"),
      },
      {
        find: "@beancount-js/parser",
        replacement: source("../../parser/src/index.ts"),
      },
      {
        find: "@beancount-js/filters",
        replacement: source("../../filters/src/index.ts"),
      },
    ],
  },
  ssr: {
    noExternal: [
      "@beancount-js/server",
      "@beancount-js/workspace",
      "@beancount-js/beancount",
      "@beancount-js/beanquery",
      "@beancount-js/parser",
      "@beancount-js/filters",
      "rrule",
    ],
  },
  server: { fs: { allow: [repoRoot] }, hmr: false },
  logLevel: "silent",
});
