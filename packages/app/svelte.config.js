import adapterNode from "@sveltejs/adapter-node";
import adapterStatic from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const runtime = process.env.BEANCOUNT_STUDIO_RUNTIME ?? "server";

/** @type {import("@sveltejs/kit").Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
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
