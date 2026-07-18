import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    include: ["@storybook/addon-a11y/preview"],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
