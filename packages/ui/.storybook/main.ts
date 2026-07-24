import type { StorybookConfig } from "@storybook/svelte-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: [
    "../../ui/src/**/*.mdx",
    "../../ui/src/**/*.stories.@(js|jsx|ts|tsx|svelte)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-svelte-csf",
    "@storybook/addon-vitest",
    "@storybook/addon-mcp",
    "storybook-addon-visual-delta",
    "storybook-addon-tag-badges",
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      server: {
        watch: {
          // The catalog's static build lives inside this package. Ignore its
          // generated output so a validation build does not trigger an HMR loop
          // in a concurrently running Storybook server.
          ignored: ["**/storybook-static/**"],
        },
      },
    }),
};

export default config;
