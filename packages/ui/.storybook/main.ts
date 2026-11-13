import type { StorybookConfig } from "@storybook/svelte-vite";
import remarkGfm from "remark-gfm";

export default {
  stories: ["../catalog/**/*.mdx", "../catalog/**/*.stories.svelte"],
  addons: [
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-svelte-csf",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: { builder: { viteConfigPath: "vite.config.ts" } },
  },
  core: { disableTelemetry: true },
} satisfies StorybookConfig;
