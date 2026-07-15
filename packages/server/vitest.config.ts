import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@beancount-js/beangulp",
        replacement: fileURLToPath(
          new URL("../beangulp/src/index.ts", import.meta.url),
        ),
      },
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
});
