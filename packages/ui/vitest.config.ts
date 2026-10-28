import { defineConfig, mergeConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import vite from "./vite.config";
export default mergeConfig(
  vite,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: [
              "src/**/*.test.ts",
              "src/**/*.spec.ts",
              "catalog/**/*.test.ts",
            ],
          },
        },
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: fileURLToPath(
                new URL("./.storybook", import.meta.url),
              ),
            }),
          ],
          test: {
            name: "storybook",
            testTimeout: 60000,
            browser: {
              enabled: true,
              headless: true,
              fileParallelism: false,
              provider: playwright({
                contextOptions: { viewport: { width: 1440, height: 1200 } },
              }),
              instances: [
                { browser: "chromium", viewport: { width: 1280, height: 800 } },
              ],
            },
          },
        },
      ],
    },
  }),
);
