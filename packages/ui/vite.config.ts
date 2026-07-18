import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const favaLib = fileURLToPath(new URL("../fava/src/lib", import.meta.url));

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
      "lucide-svelte/icons/ellipsis",
      "lucide-svelte/icons/minus",
      "lucide-svelte/icons/panel-left",
      "paneforge",
      "svelte-radix/ChevronRight.svelte",
      "svelte-radix/DotsHorizontal.svelte",
      "svelte-radix/DragHandleDots2.svelte",
    ],
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
