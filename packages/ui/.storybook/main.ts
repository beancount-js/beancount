import type { StorybookConfig } from "@storybook/svelte-vite";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";

const visualDeltaPackageRoot = fileURLToPath(
  new URL("../../storybook-addon-visual-delta", import.meta.url),
);

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
          baselinePathMode: "story-id",
          visualServerPort: 6007,
          visualUpdateArgs: [
            "exec",
            "tsx",
            "scripts/visual-baseline.ts",
            "--approved",
            "--allow-dirty",
          ],
          visualInteractionUpdateArgs: [
            "exec",
            "tsx",
            "scripts/visual-baseline.ts",
            "--interaction",
            "--approved",
            "--allow-dirty",
          ],
          visualTestArgs: ["exec", "playwright", "test"],
        },
      },
    },
    "storybook-addon-tag-badges",
  ],
  staticDirs: [
    {
      from: "../tests/visual/storybook.spec.ts-snapshots",
      to: "/visual-baselines",
    },
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
