import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const storybookTest = fileURLToPath(
  new URL("./node_modules/storybook/dist/test/index.js", import.meta.url),
);

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      // UI-owned colocated stories resolve test helpers from the catalog
      // package, which owns the Storybook runtime.
      "storybook/test": storybookTest,
    },
  },
});
