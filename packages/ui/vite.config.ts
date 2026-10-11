import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { lezer } from "@lezer/generator/rollup";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [lezer(), tailwindcss(), svelte()],
  resolve: {
    dedupe: ["svelte", "bits-ui", "@codemirror/state", "@codemirror/view"],
    alias: {
      ...Object.fromEntries(
        ["beancount", "parser", "filters", "beanquery", "beangulp"].map(
          (name) => [
            `@beancount-js/${name}`,
            fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url)),
          ],
        ),
      ),
      $lib: fileURLToPath(new URL("./src/domain/lib", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      "@lapismd/design-core/shell",
      "@lapismd/design-core/forms",
      "@lapismd/design-core/filter",
      "bits-ui",
    ],
  },
});
