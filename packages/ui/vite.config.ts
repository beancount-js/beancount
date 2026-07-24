import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const storybookTest = fileURLToPath(
  new URL("./node_modules/storybook/dist/test/index.js", import.meta.url),
);

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    // The forms icon registry is only reached by a subset of stories. Pin its
    // late-discovered entry so Vitest does not invalidate the browser runner
    // while the complete Storybook suite is already executing.
    include: ["lucide-svelte/icons/luggage"],
  },
  resolve: {
    alias: {
      // UI-owned colocated stories resolve test helpers from the catalog
      // package, which owns the Storybook runtime.
      "storybook/test": storybookTest,
    },
  },
});
