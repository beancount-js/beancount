import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const favaLib = fileURLToPath(new URL("../fava/src/lib", import.meta.url));
const storybookTest = fileURLToPath(
  new URL("./node_modules/storybook/dist/test/index.js", import.meta.url),
);

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    include: [
      "@internationalized/date",
      "@storybook/addon-a11y/preview",
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
    ],
  },
  resolve: {
    alias: {
      $lib: favaLib,
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
