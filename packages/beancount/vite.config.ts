import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import { lezer } from "@lezer/generator/rollup";

export default defineConfig({
  plugins: [lezer(), dts({ rollupTypes: false })],
  build: {
    sourcemap: "inline",
    lib: {
      name: "@beancount-js/beancount",
      entry: "src/index.ts",
    },
    rollupOptions: {
      external: (id) => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
    },
  },
  test: {
    setupFiles: ["./vitest.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/parity/**"],
    },
  },
});
