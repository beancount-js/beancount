import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, mergeConfig, loadConfigFromFile } from "vite";

const favaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolsRoot = resolve(favaRoot, "../../tools/fava-parity");
const targetPath = resolve(toolsRoot, "capture-js.ts");
process.argv = [process.argv[0] ?? "node", targetPath, ...process.argv.slice(2)];

const loaded = await loadConfigFromFile(
  { command: "serve", mode: "development" },
  resolve(favaRoot, "scripts/mcp-vite.config.mjs"),
);

const vite = await createServer(
  mergeConfig(loaded?.config ?? {}, {
    server: { middlewareMode: true },
    appType: "custom",
    resolve: {
      alias: [
        // CJS lodash default export breaks under Vite SSR `import * as _`.
        { find: "lodash", replacement: "lodash-es" },
      ],
    },
    ssr: {
      noExternal: ["lodash-es", "lodash"],
    },
  }),
);
try {
  await vite.ssrLoadModule(targetPath);
} finally {
  await vite.close();
}
