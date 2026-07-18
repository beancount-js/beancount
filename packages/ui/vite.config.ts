import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const favaLib = fileURLToPath(new URL("../fava/src/lib", import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    include: ["@storybook/addon-a11y/preview"],
  },
  resolve: {
    alias: {
      $lib: favaLib,
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
