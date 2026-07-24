import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const favaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [target, ...scriptArgs] = process.argv.slice(2);

if (!target) {
  process.stderr.write(
    "Usage: node ./scripts/run-ts.mjs <target.ts> [...args]\n",
  );
  process.exit(1);
}

const targetPath = resolve(favaRoot, target);
process.argv = [process.argv[0] ?? "node", targetPath, ...scriptArgs];

const vite = await createServer({
  configFile: resolve(favaRoot, "scripts/mcp-vite.config.mjs"),
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  await vite.ssrLoadModule(targetPath);
} catch (error) {
  await vite.close();
  throw error;
}
