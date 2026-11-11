/// <reference types="vitest" />
import { lezer } from "@lezer/generator/rollup";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  define: {
    "import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME": JSON.stringify(
      process.env.BEANCOUNT_STUDIO_RUNTIME ?? "server",
    ),
  },
  plugins: [lezer(), tailwindcss(), sveltekit()],
  resolve: {
    dedupe: ["svelte"],
    alias: {
      ...Object.fromEntries(
        [
          "beancount",
          "parser",
          "filters",
          "beanquery",
          "beangulp",
          "connector-lunchflow",
          "connector-monzo",
          "connector-starling",
        ].map((name) => [
          `@beancount-js/${name}`,
          fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url)),
        ]),
      ),
      "@beancount-js/server": fileURLToPath(
        new URL("../server/src/index.ts", import.meta.url),
      ),
    },
  },
  ssr: {
    noExternal: [
      "@beancount-js/ui",
      "@beancount-js/server",
      "@beancount-js/web",
      "@beancount-js/workspace",
      "@beancount-js/connector-lunchflow",
      "@beancount-js/connector-monzo",
      "@beancount-js/connector-starling",
      "@lapismd/design-core",
      "mode-watcher",
      "rrule",
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
  },
});
