import { defineConfig } from "vitest/config";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    sourcemap: "inline",
    lib: {
      name: "connector-lunchflow",
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
