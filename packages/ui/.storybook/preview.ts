import type { Preview } from "@storybook/svelte-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { syncCatalogStoryLayout } from "@lapismd/design-core/storybook/catalog-layout";
import "@lapismd/design-core/storybook.css";
import "@lapismd/design-core/themes/lapis.css";
import "../src/styles.css";
export default {
  tags: ["autodocs", "test"],
  globalTypes: {
    theme: { toolbar: { icon: "paintbrush", items: ["default", "lapis"] } },
    colorMode: { toolbar: { icon: "circlehollow", items: ["light", "dark"] } },
  },
  initialGlobals: { theme: "lapis", colorMode: "light" },
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    backgrounds: { disable: true },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: { default: "default", lapis: "lapis" },
      defaultTheme: "lapis",
      attributeName: "data-ui-theme",
    }),
    (story, context) => {
      syncCatalogStoryLayout(document, context);
      if (
        context.canvasElement?.parentElement === document.body &&
        !document.getElementById("storybook-root")
      ) {
        context.canvasElement.id = "storybook-root";
        document.body.classList.add("sb-main-fullscreen");
      }
      document.documentElement.classList.toggle(
        "dark",
        context.globals.colorMode === "dark",
      );
      return story();
    },
  ],
} satisfies Preview;
