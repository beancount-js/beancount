import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { lezer } from "@lezer/generator/rollup";
import dts from "vite-plugin-dts";
export default defineConfig({
  // Beanquery deliberately exposes parser and query submodules. Keep their
  // declarations as files instead of asking the declaration bundler to fold
  // directory exports into one entry point.
  plugins: [lezer(), dts({ rollupTypes: false })],
  esbuild: {
    minifyIdentifiers: false,
  },
  build: {
    sourcemap: "inline",
    lib: {
      name: "filters",
      fileName: "index",
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: (id) => id != "tslib" && !/^(\.?\/|\w:)/.test(id),
    },
  },
  test: {
    alias: {
      "@beancount-js/beancount": resolve(
        __dirname,
        "../beancount/src/index.ts",
      ),
      "@beancount-js/parser": resolve(__dirname, "../parser/src/index.ts"),
      "@beancount-js/filters": resolve(
        __dirname,
        "../filters/src/index.ts",
      ),
    },
  },
});
