import type { StorybookConfig } from "@storybook/svelte-vite";

const config: StorybookConfig = {
  stories: [
    "../../ui/src/**/*.mdx",
    "../../ui/src/**/*.stories.@(js|jsx|ts|tsx|svelte)",
    "../../forms/src/**/*.stories.@(js|jsx|ts|tsx|svelte)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-svelte-csf",
    "@storybook/addon-vitest",
    "@storybook/addon-mcp",
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },
};

export default config;
