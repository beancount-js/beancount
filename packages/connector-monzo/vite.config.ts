import { defineConfig } from "vitest/config";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  resolve: {
    alias: [
      {
        find: "@beancount-js/beancount",
        replacement: fileURLToPath(
          new URL("../beancount/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@beancount-js/beangulp",
        replacement: fileURLToPath(
          new URL("../beangulp/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@beancount-js/parser",
        replacement: fileURLToPath(
          new URL("../parser/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@beancount-js/filters",
        replacement: fileURLToPath(
          new URL("../filters/dist/index.js", import.meta.url),
        ),
      },
    ],
  },
  build: {
    sourcemap: "inline",
    lib: {
      name: "connector-monzo",
      fileName: "index",
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) => id != "tslib" && !/^(\.?\/|\w:)/.test(id),
    },
  },
  test: {
    include: ["src/**/*.spec.ts"],
  },
});
