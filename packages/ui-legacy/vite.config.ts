import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@beancount-js/beancount": fileURLToPath(
        new URL("../beancount/src/index.ts", import.meta.url),
      ),
    },
  },
});
