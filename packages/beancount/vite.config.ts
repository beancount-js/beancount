import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      name: "@beancount-js/beancount",
      entry: "index.ts",
    },
  },
  test: {
    setupFiles: ["./vitest.ts"],
  },
});
