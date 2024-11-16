/// <reference types="vitest" />
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import builtins from "builtin-modules";
import { PluginOption, defineConfig } from "vite";
import { fileURLToPath, URL } from "url";

export default defineConfig((_cfg) => {
  return {
    assetsInclude: ["**/*.ledger"],
    plugins: [svelte({ preprocess: vitePreprocess() }) as PluginOption],
    resolve: {
      alias: [
        {
          find: "$lib",
          replacement: fileURLToPath(new URL("./src/lib", import.meta.url)),
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
