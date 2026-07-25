import type { StorybookConfig } from "@storybook/svelte-vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mergeConfig } from "vite";

const visualDeltaPackageRoot = path.resolve(
  process.env.VISUAL_DELTA_SOURCE_DIR
    ? path.join(process.env.VISUAL_DELTA_SOURCE_DIR, "..")
    : "/Users/stevejuma/ui/packages/storybook-addon-visual-delta",
);
const visualDeltaCli = path.join(visualDeltaPackageRoot, "src/node/cli.ts");

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
    {
      name: import.meta.resolve("./visual-delta-preset.ts"),
      options: {
        visualDelta: {
          visualUpdateArgs: [
            "exec",
            "tsx",
            visualDeltaCli,
            "update",
            "--allow-dirty",
            "--approved",
            "--skip-build",
          ],
          visualInteractionUpdateArgs: [
            "exec",
            "tsx",
            visualDeltaCli,
            "interaction-update",
            "--allow-dirty",
            "--approved",
            "--skip-build",
          ],
        },
      },
    },
    "storybook-addon-tag-badges",
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "storybook-addon-visual-delta": visualDeltaPackageRoot,
        },
      },
      optimizeDeps: {
        exclude: ["storybook-addon-visual-delta"],
      },
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
