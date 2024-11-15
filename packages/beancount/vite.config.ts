import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    sourcemap: "inline",
    lib: {
      name: "@beancount-js/beancount",
      entry: "src/index.ts",
    },
  },
  test: {
    setupFiles: ["./vitest.ts"],
  },
});
