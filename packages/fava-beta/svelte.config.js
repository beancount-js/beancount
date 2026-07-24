import adapterNode from "@sveltejs/adapter-node";
import adapterStatic from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath, URL } from "node:url";

const runtime = process.env.BEANCOUNT_STUDIO_RUNTIME ?? "server";

/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: undefined,
  },
  kit: {
    alias: {
      "@beancount-js/beancount": fileURLToPath(
        new URL("../beancount/src/index.ts", import.meta.url),
      ),
      "@beancount-js/parser": fileURLToPath(
        new URL("../parser/src/index.ts", import.meta.url),
      ),
      "@beancount-js/filters": fileURLToPath(
        new URL("../filters/src/index.ts", import.meta.url),
      ),
    },
    adapter:
      runtime === "web"
        ? adapterStatic({
            pages: "build-web",
            assets: "build-web",
            fallback: "index.html",
            strict: false,
          })
        : adapterNode({ out: "build-server" }),
  },
};

export default config;
