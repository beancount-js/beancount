import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { lezer } from "@lezer/generator/rollup";
import dts from "vite-plugin-dts";
export default defineConfig({
  plugins: [lezer(), dts({ rollupTypes: true })],
  build: {
    sourcemap: "inline",
    lib: {
      name: "filters",
      fileName: "index",
      entry: resolve(__dirname, "src/index.ts"),
    },
  },
});
