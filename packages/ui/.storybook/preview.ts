import type { Preview } from "@storybook/svelte-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { syncCatalogStoryLayout } from "@lapismd/design-core/storybook/catalog-layout";
import "@lapismd/design-core/storybook.css";
import "@lapismd/design-core/themes/lapis.css";
import "../src/styles.css";
import { requirementTocLabel } from "./requirement-toc";
export default {
  tags: ["autodocs", "test"],
  globalTypes: {
    theme: {
      description: "Brand theme",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "lapis", title: "Lapis" },
          { value: "default", title: "Default" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "lapis", colorMode: "light" },
  parameters: {
    options: {
      storySort: {
        order: [
          "Specification",
          [
            "Beancount Studio specification",
            "Application baseline",
            "Beancount language",
            "Accounting and query",
            "Application UI",
            "Ingestion and rules",
            "Hosts and storage",
            "Storybook catalog",
            "Specification governance",
            "Verification",
          ],
          "Beancount",
          "*",
        ],
      },
    },
    layout: "fullscreen",
    a11y: { test: "error" },
    backgrounds: { disable: true },
    themes: { disable: true },
    docs: {
      toc: {
        headingSelector: "h2",
        title: "On this page",
        unsafeTocbotOptions: {
          headingLabelCallback: requirementTocLabel,
        },
      },
    },
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
        context.parameters.beancountApplication &&
        context.viewMode === "story"
      ) {
        document.body.setAttribute("data-ui-catalog-full-viewport", "");
      }
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
