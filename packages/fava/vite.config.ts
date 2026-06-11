/// <reference types="vitest" />
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import builtins from "builtin-modules";
import { lezer } from "@lezer/generator/rollup";
import { type PluginOption, defineConfig } from "vite";
import { fileURLToPath, URL } from "url";

export default defineConfig((_cfg) => {
  return {
    assetsInclude: ["**/*.ledger"],
    plugins: [lezer(), svelte({ preprocess: vitePreprocess() }) as PluginOption],
    resolve: {
      alias: [
        {
          find: "$lib",
          replacement: fileURLToPath(new URL("./src/lib", import.meta.url)),
        },
        {
          find: "@beancount-js/beancount",
          replacement: fileURLToPath(
            new URL("../beancount/src/index.ts", import.meta.url),
          ),
        },
        {
          find: "@beancount-js/parser",
          replacement: fileURLToPath(
            new URL("../parser/src/index.ts", import.meta.url),
          ),
        },
        {
          find: "@beancount-js/filters",
          replacement: fileURLToPath(
            new URL("../filters/src/index.ts", import.meta.url),
          ),
        },
        {
          find: "@codemirror/text",
          replacement: "@codemirror/state",
        },
      ],
    },
    test: {
      environment: "jsdom",
    },
    build: {
      lib: {
        name: "@beancount-js/fava",
        entry: "src/main.ts",
        formats: ["cjs"],
      },
      rollupOptions: {
        external: [
          // "@codemirror/collab",
					// "@codemirror/commands",
          // "@codemirror/lint",
					// "@codemirror/search",
					// "@codemirror/state",
					// "@codemirror/view",
          ...builtins
        ],
      },
      outDir: "dist",
      emptyOutDir: false,
      sourcemap: "inline",
    },
  };
});
