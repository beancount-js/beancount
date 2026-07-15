import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [dts({ rollupTypes: false })],
  resolve: {
    alias: [
      {
        find: "@beancount-js/beancount",
        replacement: fileURLToPath(
          new URL("../beancount/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@beancount-js/parser",
        replacement: fileURLToPath(
          new URL("../parser/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  build: {
    sourcemap: "inline",
    lib: {
      name: "@beancount-js/beangulp",
      entry: "src/index.ts",
    },
    rollupOptions: {
      external: (id) => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
    },
  },
});
