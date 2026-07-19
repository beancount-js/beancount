import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const favaLib = fileURLToPath(new URL("../fava/src/lib", import.meta.url));
const beancountSource = fileURLToPath(
  new URL("../beancount/src/index.ts", import.meta.url),
);
const svelteKitNavigation = fileURLToPath(
  new URL("./.storybook/sveltekit-navigation.ts", import.meta.url),
);
const svelteKitStores = fileURLToPath(
  new URL("./.storybook/sveltekit-stores.ts", import.meta.url),
);
const d3Array = fileURLToPath(
  new URL("../fava/node_modules/d3-array/src/index.js", import.meta.url),
);
const virtualList = fileURLToPath(
  new URL(
    "../fava/node_modules/svelte-tiny-virtual-list/src/index.js",
    import.meta.url,
  ),
);
const storybookTest = fileURLToPath(
  new URL("./node_modules/storybook/dist/test/index.js", import.meta.url),
);

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    include: [
      "@internationalized/date",
      "@storybook/addon-a11y/preview",
      "d3-array",
      "lucide-svelte/icons/chevron-left",
      "lucide-svelte/icons/chevron-right",
      "lucide-svelte/icons/chevron-up",
      "lucide-svelte/icons/circle",
      "lucide-svelte/icons/clipboard-list",
      "lucide-svelte/icons/database-zap",
      "lucide-svelte/icons/ellipsis",
      "lucide-svelte/icons/fold-vertical",
      "lucide-svelte/icons/folder-open",
      "lucide-svelte/icons/layout-panel-left",
      "lucide-svelte/icons/minus",
      "lucide-svelte/icons/moon",
      "lucide-svelte/icons/panel-left",
      "lucide-svelte/icons/play",
      "lucide-svelte/icons/refresh-cw",
      "lucide-svelte/icons/save",
      "lucide-svelte/icons/scan-search",
      "lucide-svelte/icons/settings",
      "lucide-svelte/icons/settings-2",
      "lucide-svelte/icons/sparkles",
      "lucide-svelte/icons/unfold-vertical",
      "paneforge",
      "svelte-radix/ChevronRight.svelte",
      "svelte-radix/DotsHorizontal.svelte",
      "svelte-radix/DragHandleDots2.svelte",
      "svelte-tiny-virtual-list",
    ],
  },
  resolve: {
    alias: {
      $lib: favaLib,
      // Catalog Fava's Beancount source rather than its package distribution,
      // which cannot resolve its internal source modules in Vite.
      "@beancount-js/beancount": beancountSource,
      // Fava-only dependencies used by catalogued components are resolved from
      // the application workspace, where pnpm keeps their source packages.
      "d3-array": d3Array,
      "svelte-tiny-virtual-list": virtualList,
      // Fava owns its real SvelteKit router. These compatibility modules let
      // its in-memory navigation render in the isolated Storybook preview.
      "$app/navigation": svelteKitNavigation,
      "$app/stores": svelteKitStores,
      // Colocated Stories under `packages/forms` resolve test helpers from the
      // catalog package, which owns the Storybook runtime.
      "storybook/test": storybookTest,
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
