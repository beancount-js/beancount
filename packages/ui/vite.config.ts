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
      "@lapismd/design-core/shadcn/accordion",
      "@lapismd/design-core/shadcn/alert",
      "@lapismd/design-core/shadcn/alert-dialog",
      "@lapismd/design-core/shadcn/badge",
      "@lapismd/design-core/shadcn/breadcrumb",
      "@lapismd/design-core/shadcn/button",
      "@lapismd/design-core/shadcn/collapsible",
      "@lapismd/design-core/shadcn/dialog",
      "@lapismd/design-core/shadcn/dropdown-menu",
      "@lapismd/design-core/shadcn/empty",
      "@lapismd/design-core/shadcn/input",
      "@lapismd/design-core/shadcn/pagination",
      "@lapismd/design-core/shadcn/popover",
      "@lapismd/design-core/shadcn/progress",
      "@lapismd/design-core/shadcn/scroll-area",
      "@lapismd/design-core/shadcn/select",
      "@lapismd/design-core/shadcn/separator",
      "@lapismd/design-core/shadcn/sheet",
      "@lapismd/design-core/shadcn/skeleton",
      "@lapismd/design-core/shadcn/switch",
      "@lapismd/design-core/shadcn/tabs",
      "@lapismd/design-core/shadcn/textarea",
      "@lapismd/design-core/shadcn/toggle-group",
      "@lapismd/design-core/shadcn/tooltip",
      "bits-ui",
    ],
  },
});
