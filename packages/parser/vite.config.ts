import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      name: "@beancount-js/parser",
      fileName: "index",
      entry: resolve(__dirname, "src/index.ts"),
    },
  },
});
