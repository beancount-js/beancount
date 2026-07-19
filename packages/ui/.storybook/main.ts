import type { StorybookConfig } from "@storybook/svelte-vite";

const config: StorybookConfig = {
  stories: [
    "../../ui/src/**/*.mdx",
    "../../ui/src/**/*.stories.@(js|jsx|ts|tsx|svelte)",
    // Fava stories remain available only while they have no independent UI
    // copy. The explicit list makes a copied component's UI source canonical
    // in Storybook without modifying the original application source.
    "../../fava/src/components/FavaNavigation.stories.@(js|jsx|ts|tsx|svelte)",
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
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    server: {
      ...viteConfig.server,
      watch: {
        ...viteConfig.server?.watch,
        // The catalog's static build lives inside this package. Ignore its
        // generated output so a validation build does not trigger an HMR loop
        // in a concurrently running Storybook server.
        ignored: ["**/storybook-static/**"],
      },
    },
  }),
};

export default config;
